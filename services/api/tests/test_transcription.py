"""Public Job/result behavior with an external fake Runtime and real owned files."""

import io
from pathlib import Path
import time
import wave

from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from music_api.runtime_types import RuntimeArtifact, RuntimeResult


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
