"""Independent edited Scores are saved through the application HTTP boundary."""

from pathlib import Path
import io
import subprocess
import tarfile
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor

import pytest

from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.main import create_app
from test_generate_from_score import SELECTED_ABC, source_version
from test_generation_versions import INPUTS, wait_job
from test_lifecycle import server
from test_transcription import reference_audio


def test_save_edit_reopen_and_generate_retains_actual_score_and_original_parent(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path, runtime_mode="fake")
    with TestClient(create_app(settings)) as client:
        project = client.post("/projects", json={"name": "Melody edit"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        source = client.get(base + "/scores/" + original["score_id"]).json()
        original_bytes = client.get(base + "/assets/" + source["abc_asset_id"] + "/content").content
        jobs = client.get(base + "/jobs").json()
        saved = client.post(base + "/scores", json={"abc": SELECTED_ABC, "source_score_id": source["id"], "parent_version_id": original["id"]})
        assert saved.status_code == 201, saved.text
        edit = saved.json()
        assert edit["id"] != source["id"]
        assert edit["abc_asset_id"] != source["abc_asset_id"]
        assert edit["job_id"] is None
        assert edit["source_score_id"] == source["id"]
        assert edit["parent_version_id"] == original["id"]
        assert client.get(base + "/assets/" + edit["abc_asset_id"] + "/content").content == SELECTED_ABC.encode()
        assert client.get(base + "/jobs").json() == jobs
        assert client.get(base + "/versions").json() == [original]
    with TestClient(create_app(settings)) as client:
        assert client.get(base + "/scores/" + edit["id"]).json() == edit
        inputs = dict(INPUTS, abc=SELECTED_ABC, source_score_id=edit["id"], parent_version_id=original["id"])
        submitted = client.post(base + "/jobs/generate-from-score", json=inputs)
        assert submitted.status_code == 202, submitted.text
        job = wait_job(client, project["id"], submitted.json()["id"])
        assert job["status"] == "completed", job
        assert job["inputs"]["source_score_id"] == edit["id"]
        version = client.post(base + "/versions", json={"candidate_id": job["result"]["candidate_id"], "name": "Edited melody"})
        assert version.status_code == 201
        assert version.json()["parent_version_id"] == original["id"]
        assert client.get(base + "/versions/" + original["id"]).json() == original
        assert client.get(base + "/assets/" + source["abc_asset_id"] + "/content").content == original_bytes


@pytest.mark.parametrize("abc", ["X:1\nK:C\nC ? D |", "X:1\nT:Single voice\nM:4/4\nL:1/4\nK:C\nC D E F |"])
def test_invalid_or_unsupported_edit_creates_no_persistent_result(tmp_path: Path, abc: str) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"))) as client:
        project = client.post("/projects", json={"name": "Keep original"}).json()
        base = "/projects/" + project["id"]
        checked = client.post(base + "/scores/validate", json={"abc": abc})
        assert checked.status_code == 422
        assert checked.json()["error"]["code"] == "score_invalid"
        response = client.post(base + "/scores", json={"abc": abc})
        assert response.status_code == 422
        for route in ("assets", "scores", "jobs", "candidates", "versions"):
            assert client.get(base + "/" + route).json() == []


def test_failed_storage_preserves_saved_files_and_edit_can_be_retried(tmp_path: Path, monkeypatch) -> None:
    from music_api.storage import Storage

    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"))) as client:
        project = client.post("/projects", json={"name": "Recover edit"}).json()
        base = "/projects/" + project["id"]
        original = client.post(base + "/scores", json={"abc": SELECTED_ABC}).json()
        assets = client.get(base + "/assets").json()
        original_content = client.get(base + "/assets/" + original["abc_asset_id"] + "/content").content
        with monkeypatch.context() as patch:
            def unavailable(*args, **kwargs):
                raise OSError("Owned storage failure")
            patch.setattr(Storage, "publish", unavailable)
            failure = client.post(base + "/scores", json={"abc": SELECTED_ABC.replace("C4 D4", "G4 A4"), "source_score_id": original["id"]})
            assert failure.status_code == 503
            assert failure.json()["error"]["code"] == "score_save_failed"
        assert client.get(base + "/assets").json() == assets
        assert client.get(base + "/scores").json() == [original]
        assert client.get(base + "/assets/" + original["abc_asset_id"] + "/content").content == original_content
        retry = client.post(base + "/scores", json={"abc": SELECTED_ABC.replace("C4 D4", "G4 A4"), "source_score_id": original["id"]})
        assert retry.status_code == 201


def test_save_intent_replay_returns_one_score_and_rejects_changed_abc(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path, runtime_mode="fake")
    with TestClient(create_app(settings)) as client:
        project = client.post("/projects", json={"name": "One saved intent"}).json()
        base = "/projects/" + project["id"]
        intent = {"save_id": str(uuid4()), "abc": SELECTED_ABC}
        first = client.post(base + "/scores", json=intent)
        assert first.status_code == 201
        with ThreadPoolExecutor(max_workers=2) as pool:
            replays = list(pool.map(lambda _: client.post(base + "/scores", json=intent), range(2)))
        assert all(response.status_code == 200 for response in replays)
        assert all(response.json() == first.json() for response in replays)
        conflict = client.post(base + "/scores", json=dict(intent, abc=SELECTED_ABC.replace("C4 D4", "G4 A4")))
        assert conflict.status_code == 409
        assert conflict.json()["error"]["code"] == "score_save_conflict"
        assert client.get(base + "/scores").json() == [first.json()]
        assert len(client.get(base + "/assets").json()) == 1
    with TestClient(create_app(settings)) as client:
        replay = client.post(base + "/scores", json=intent)
        assert replay.status_code == 200
        assert replay.json() == first.json()


def test_concurrent_first_save_intent_creates_one_readable_score(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"))) as client:
        project = client.post("/projects", json={"name": "Concurrent save"}).json()
        base = "/projects/" + project["id"]
        intent = {"save_id": str(uuid4()), "abc": SELECTED_ABC}
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: client.post(base + "/scores", json=intent), range(2)))
        assert sorted(response.status_code for response in responses) == [200, 201]
        assert responses[0].json() == responses[1].json()
        assert client.get(base + "/scores").json() == [responses[0].json()]
        assert len(client.get(base + "/assets").json()) == 1


def test_lost_commit_acknowledgement_returns_recoverable_id_and_retry_is_same_score(tmp_path: Path, monkeypatch) -> None:
    from sqlalchemy.orm import Session

    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"))) as client:
        project = client.post("/projects", json={"name": "Recover saved Score"}).json()
        base = "/projects/" + project["id"]
        intent = {"save_id": str(uuid4()), "abc": SELECTED_ABC}
        commit = Session.commit
        with monkeypatch.context() as patch:
            def lose_acknowledgement(session):
                commit(session)
                raise RuntimeError("Owned lost commit acknowledgement")
            patch.setattr(Session, "commit", lose_acknowledgement)
            failure = client.post(base + "/scores", json=intent)
            assert failure.status_code == 503
            assert failure.json()["error"]["code"] == "score_commit_unconfirmed"
            assert failure.json()["error"]["resource_id"] == intent["save_id"]
        saved = client.get(base + "/scores/" + intent["save_id"])
        assert saved.status_code == 200
        replay = client.post(base + "/scores", json=intent)
        assert replay.status_code == 200
        assert replay.json() == saved.json()
        assert len(client.get(base + "/assets").json()) == 1
        assert client.get(base + "/assets/" + saved.json()["abc_asset_id"] + "/content").content == SELECTED_ABC.encode()


def test_save_id_cannot_claim_inference_foreign_or_different_source_scores(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"))) as client:
        project = client.post("/projects", json={"name": "Preserve ownership"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        edit_intent = {"save_id": str(uuid4()), "abc": SELECTED_ABC, "source_score_id": original["score_id"], "parent_version_id": original["id"]}
        edit = client.post(base + "/scores", json=edit_intent).json()
        other = client.post("/projects", json={"name": "Other owner"}).json()
        other_base = "/projects/" + other["id"]
        foreign = client.post(other_base + "/scores", json={"abc": SELECTED_ABC}).json()
        old_scores = client.get(base + "/scores").json()
        old_assets = client.get(base + "/assets").json()
        old_bytes = {asset["id"]: client.get(base + "/assets/" + asset["id"] + "/content").content for asset in old_assets}
        for intent in (dict(edit_intent, save_id=original["score_id"]), {"save_id": foreign["id"], "abc": SELECTED_ABC}, {"save_id": edit["id"], "abc": SELECTED_ABC}):
            collision = client.post(base + "/scores", json=intent)
            assert collision.status_code == 409
            assert collision.json()["error"]["code"] == "score_save_conflict"
        assert client.get(base + "/scores").json() == old_scores
        assert client.get(base + "/assets").json() == old_assets
        assert client.get(base + "/versions").json() == [original]
        assert client.get(other_base + "/scores").json() == [foreign]
        for asset_id, expected in old_bytes.items():
            assert client.get(base + "/assets/" + asset_id + "/content").content == expected


def test_actual_0006_populated_graph_upgrades_and_preserves_history_and_bytes(tmp_path: Path) -> None:
    baseline = tmp_path / "baseline"
    baseline.mkdir()
    repository = Path(__file__).resolve().parents[3]
    archive = subprocess.check_output(["git", "-C", str(repository), "archive", "677718bfaa19542244e899b1b751522ac5f846bd",
        "services/api/src", "workflows", "runtime/comfyui/runtime.json", "runtime/comfyui/models.json", "runtime/comfyui/workflows"])
    with tarfile.open(fileobj=io.BytesIO(archive)) as content:
        content.extractall(baseline, filter="data")
    data = tmp_path / "application"
    with server(data, tmp_path / "old-api.log", source_root=baseline / "services/api/src") as client:
        project = client.post("/projects", json={"name": "Before Score editing"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
        transcription = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
        assert wait_job(client, project["id"], transcription["id"])["status"] == "completed"
        selected = client.post(base + "/jobs/generate-from-score", json=dict(INPUTS, abc=SELECTED_ABC, source_score_id=original["score_id"], parent_version_id=original["id"])).json()
        child_job = wait_job(client, project["id"], selected["id"])
        assert child_job["status"] == "completed"
        child = client.post(base + "/versions", json={"candidate_id": child_job["result"]["candidate_id"], "name": "Existing child"})
        assert child.status_code == 201
        history = {route: client.get(base + "/" + route).json() for route in ("assets", "scores", "jobs", "candidates", "versions")}
        original_bytes = {asset["id"]: client.get(base + "/assets/" + asset["id"] + "/content").content for asset in history["assets"]}
    with server(data, tmp_path / "new-api.log") as client:
        assert client.get(base).json() == project
        for route, expected in history.items():
            if route == "scores":
                expected = [dict(score, source_score_id=None, parent_version_id=None) for score in expected]
            assert client.get(base + "/" + route).json() == expected
        edit = client.post(base + "/scores", json={"abc": SELECTED_ABC, "source_score_id": original["score_id"], "parent_version_id": original["id"]})
        assert edit.status_code == 201, edit.text
        for asset_id, expected_bytes in original_bytes.items():
            assert client.get(base + "/assets/" + asset_id + "/content").content == expected_bytes
    with server(data, tmp_path / "reopened-api.log") as client:
        assert client.get(base + "/scores/" + edit.json()["id"]).json() == edit.json()
        for version in history["versions"]:
            assert client.get(base + "/versions/" + version["id"]).json() == version
