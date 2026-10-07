"""Public Job/result behavior with an external fake Runtime and real owned files."""

import io
from contextlib import closing
import sqlite3
from pathlib import Path
import time
import wave

from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from music_api.runtime_types import RuntimeArtifact, RuntimeResult
from music_api.job_models import Job
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session


ABC = b"X:1\nM:4/4\nL:1/4\nK:C\nC D E F |\n"


def reference_audio() -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
        writer.writeframes(b"\x10\x00" * 384000)
    return output.getvalue()


def terminal(client: TestClient, url: str) -> dict[str, object]:
    deadline = time.monotonic() + 5
    while True:
        response = client.get(url)
        assert response.status_code == 200
        job = response.json()
        if job["status"] in {"completed", "failed", "cancelled"}:
            return job
        assert time.monotonic() < deadline, job
        time.sleep(0.01)


def test_valid_abc_without_midi_cannot_complete_or_publish_a_score(tmp_path: Path) -> None:
    runtime = FakeInferenceRuntime(results={"Transcribe": RuntimeResult(
        (RuntimeArtifact("abc", ABC, "abc", "text/vnd.abc", "score.abc"),),
        score_validation={"valid": True, "note_count": 4, "duration_seconds": 4})})
    source = reference_audio()
    with TestClient(create_app(Settings(data_dir=tmp_path), runtime=runtime)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        reference = client.post(base + "/assets", files={"file": ("reference.wav", source)}).json()
        response = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]})
        assert response.status_code == 202
        job = terminal(client, base + "/jobs/" + response.json()["id"])
        assert job["status"] == "failed"
        assert job["result"] is None
        assert "midi" in job["error"]["message"].lower()
        assert client.get(base + "/scores").json() == []
        assert client.get(base + "/assets").json() == [reference]
        assert client.get(base + "/assets/" + reference["id"] + "/content").content == source


def test_complete_transcription_keeps_result_ids_after_native_outputs_are_removed_and_app_reopens(tmp_path: Path) -> None:
    native_outputs = tmp_path / "owned-fake-native-outputs"
    data_dir = tmp_path / "application"
    runtime = FakeInferenceRuntime(output_dir=native_outputs)
    with TestClient(create_app(Settings(data_dir=data_dir), runtime=runtime)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
        created = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
        completed = terminal(client, base + "/jobs/" + created["id"])
        assert completed["status"] == "completed"
        result = completed["result"]
        score = client.get(base + "/scores/" + result["score_id"]).json()
        assert score["source_reference_asset_id"] == reference["id"]
        assert score["abc_asset_id"] == result["abc_asset_id"]
        abc = client.get(base + "/assets/" + result["abc_asset_id"] + "/content").content
        midi = client.get(base + "/assets/" + result["midi_asset_id"] + "/content").content
        assert abc == ABC
        assert midi[:14] == b"MThd\x00\x00\x00\x06\x00\x00\x00\x01\x01\xe0"
        assert b"\x90\x3c\x40" in midi
        assets = client.get(base + "/assets").json()
        assert len(assets) == 3
        assert native_outputs.resolve().is_relative_to(tmp_path.resolve())
        for path in native_outputs.rglob("*"):
            if path.is_file():
                path.unlink()
        runtime.results.clear()
        assert client.get(base + "/jobs/" + created["id"]).json() == completed
        assert client.get(base + "/assets").json() == assets
        assert client.get(base + "/scores").json() == [score]
        assert client.get(base + "/assets/" + result["midi_asset_id"] + "/content").content == midi
    with TestClient(create_app(Settings(data_dir=data_dir))) as client:
        assert client.get(base + "/jobs/" + created["id"]).json() == completed
        assert client.get(base + "/scores").json() == [score]
        assert client.get(base + "/assets").json() == assets
        assert client.get(base + "/assets/" + result["abc_asset_id"] + "/content").content == abc
        assert client.get(base + "/assets/" + result["midi_asset_id"] + "/content").content == midi


def test_result_commit_lost_acknowledgement_preserves_completed_job_and_whole_owned_set(tmp_path: Path) -> None:
    faulted = {"value": False}

    def lose_result_ack(session: Session) -> None:
        if not faulted["value"] and any(isinstance(item, Job) and item.status == "completed" for item in session.identity_map.values()):
            faulted["value"] = True
            raise RuntimeError("External commit provider lost the completed result acknowledgement")

    event.listen(Session, "after_commit", lose_result_ack)
    try:
        with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
            created = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            job = terminal(client, base + "/jobs/" + created["id"])
            assert faulted["value"]
            assert job["status"] == "completed"
            assert job["error"] is None
            result = job["result"]
            assert client.get(base + "/assets/" + result["abc_asset_id"] + "/content").content == ABC
            midi = client.get(base + "/assets/" + result["midi_asset_id"] + "/content").content
            assert midi[:4] == b"MThd"
            assets, scores = client.get(base + "/assets").json(), client.get(base + "/scores").json()
            assert len(assets) == 3 and len(scores) == 1
            for _ in range(3):
                assert client.get(base + "/jobs/" + created["id"]).json() == job
                assert client.get(base + "/assets").json() == assets
                assert client.get(base + "/scores").json() == scores
    finally:
        event.remove(Session, "after_commit", lose_result_ack)
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        assert client.get(base + "/jobs/" + created["id"]).json() == job
        assert client.get(base + "/scores").json() == scores
        assert client.get(base + "/assets").json() == assets
        assert client.get(base + "/assets/" + result["abc_asset_id"] + "/content").content == ABC
        assert client.get(base + "/assets/" + result["midi_asset_id"] + "/content").content == midi


def test_result_metadata_abort_does_not_complete_or_keep_unregistered_files(tmp_path: Path) -> None:
    source = reference_audio()
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        reference = client.post(base + "/assets", files={"file": ("reference.wav", source)}).json()
        with closing(sqlite3.connect(tmp_path / "app.sqlite")) as database, database:
            database.execute("CREATE TRIGGER abort_score BEFORE INSERT ON scores BEGIN SELECT RAISE(ABORT, 'external result metadata failure'); END")
        created = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
        job = terminal(client, base + "/jobs/" + created["id"])
        assert job["status"] == "failed" and job["result"] is None
        assert client.get(base + "/scores").json() == []
        assert client.get(base + "/assets").json() == [reference]
        assert client.get(base + "/assets/" + reference["id"] + "/content").content == source
        assert not list((tmp_path / "assets").rglob("*.abc"))
        assert not list((tmp_path / "assets").rglob("*.mid"))


def test_invalid_midi_with_valid_abc_is_rejected_before_any_output_publication(tmp_path: Path) -> None:
    runtime = FakeInferenceRuntime(results={"Transcribe": RuntimeResult(
        (RuntimeArtifact("abc", ABC, "abc", "text/vnd.abc", "score.abc"),
         RuntimeArtifact("midi", b"MThd\x00\x00", "mid", "audio/midi", "score.mid")),
        score_validation={"valid": True, "note_count": 4})})
    with TestClient(create_app(Settings(data_dir=tmp_path), runtime=runtime)) as client:
        project = client.post("/projects", json={"name":"Morning song"}).json()
        base = "/projects/" + project["id"]
        reference = client.post(base + "/assets", files={"file":("reference.wav",reference_audio())}).json()
        created = client.post(base + "/transcriptions", json={"reference_asset_id":reference["id"]}).json()
        job = terminal(client, base + "/jobs/" + created["id"])
        assert job["status"] == "failed" and job["result"] is None
        assert client.get(base + "/scores").json() == []
        assert client.get(base + "/assets").json() == [reference]
        assert not list((tmp_path / "assets").rglob("*.abc"))
        assert not list((tmp_path / "assets").rglob("*.mid"))


def test_mode_switch_cannot_silently_read_fake_results_as_real(tmp_path: Path) -> None:
    import pytest
    from music_api.errors import DomainError
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name":"Morning song"}).json()
    with pytest.raises(DomainError, match="different Runtime mode"):
        with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="comfyui"))):
            pass
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        assert client.get("/projects/" + project["id"]).json() == project


def test_result_ack_and_readback_loss_retains_committed_files_and_cannot_downgrade_completion(tmp_path: Path) -> None:
    import threading
    armed = {"commit": True, "readback": False}
    readback_fault_seen = threading.Event()

    def lose_ack(session: Session) -> None:
        if armed["commit"] and any(isinstance(item, Job) and item.status == "completed" for item in session.identity_map.values()):
            armed["commit"], armed["readback"] = False, True
            raise RuntimeError("External acknowledgement lost after result commit")

    def lose_readback(connection, cursor, statement, parameters, context, executemany):
        if armed["readback"] and statement.startswith("SELECT jobs.status"):
            armed["readback"] = False
            readback_fault_seen.set()
            raise sqlite3.OperationalError("External result confirmation read unavailable")

    event.listen(Session, "after_commit", lose_ack)
    event.listen(Engine, "before_cursor_execute", lose_readback)
    try:
        with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
            project = client.post("/projects", json={"name":"Morning song"}).json()
            base = "/projects/" + project["id"]
            reference = client.post(base + "/assets", files={"file":("reference.wav",reference_audio())}).json()
            created = client.post(base + "/transcriptions", json={"reference_asset_id":reference["id"]}).json()
            job = terminal(client, base + "/jobs/" + created["id"])
            assert readback_fault_seen.wait(2), "The external confirmation read fault must actually execute"
            assert armed == {"commit":False,"readback":False}
            assert job["status"] == "completed"
            assert client.get(base + "/assets/" + job["result"]["abc_asset_id"] + "/content").content == ABC
            assert client.get(base + "/assets/" + job["result"]["midi_asset_id"] + "/content").content.startswith(b"MThd")
            assert len(client.get(base + "/scores").json()) == 1
            assert len(client.get(base + "/assets").json()) == 3
    finally:
        event.remove(Session, "after_commit", lose_ack)
        event.remove(Engine, "before_cursor_execute", lose_readback)
