"""Persisted generation works after a real CPU API process restart."""

import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from test_generation_versions import INPUTS, wait_job
from test_lifecycle import server


def test_actual_generation_process_restart_preserves_saved_history(tmp_path: Path) -> None:
    assert importlib.util.find_spec("torch") is None
    data_dir = tmp_path / "application"
    with server(data_dir, tmp_path / "first-server.log") as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        submitted = client.post(base + "/jobs/generate", json=INPUTS)
        assert submitted.status_code == 202
        job = wait_job(client, project["id"], submitted.json()["id"])
        assert job["status"] == "completed", job
        candidate = client.get(base + "/candidates/" + job["result"]["candidate_id"]).json()
        response = client.post(base + "/versions", json={"candidate_id": candidate["id"], "name": "Persisted morning"})
        assert response.status_code == 201
        version = response.json()
        assets = client.get(base + "/assets").json()
        content = {asset["id"]: client.get(base + "/assets/" + asset["id"] + "/content").content for asset in assets}
    with server(data_dir, tmp_path / "second-server.log") as client:
        assert client.get(base + "/jobs/" + job["id"]).json() == job
        assert client.get(base + "/candidates").json() == [candidate]
        assert client.get(base + "/versions").json() == [version]
        assert client.get(base + "/versions/" + version["id"]).json() == version
        assert client.get(base + "/assets").json() == assets
        for identifier, original in content.items():
            assert client.get(base + "/assets/" + identifier + "/content").content == original


def test_imported_candidate_survives_deletion_of_its_isolated_fake_peer_outputs(tmp_path: Path) -> None:
    data_dir, peer_dir = tmp_path / "application", tmp_path / "fake-peer"
    runtime = FakeInferenceRuntime(result_factories={"Generate": generation_fixture}, output_dir=peer_dir)
    with TestClient(create_app(Settings(data_dir=data_dir, runtime_mode="fake"), runtime=runtime)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        submitted = client.post(base + "/jobs/generate", json=INPUTS).json()
        job = wait_job(client, project["id"], submitted["id"])
        assert job["status"] == "completed", job
        version = client.post(base + "/versions", json={"candidate_id": job["result"]["candidate_id"], "name": "Owned morning"}).json()
        assets = client.get(base + "/assets").json()
        content = {asset["id"]: client.get(base + "/assets/" + asset["id"] + "/content").content for asset in assets}
    assert peer_dir.resolve().is_relative_to(tmp_path.resolve())
    peers = list(peer_dir.iterdir())
    assert len(peers) == 1
    for folder in peers:
        files = list(folder.iterdir())
        assert {path.name for path in files} == {"audio.flac", "abc.abc"}
        for path in files:
            path.unlink()
        folder.rmdir()
    peer_dir.rmdir()
    with server(data_dir, tmp_path / "readback-server.log") as client:
        assert client.get(base + "/versions/" + version["id"]).json() == version
        for identifier, original in content.items():
            assert client.get(base + "/assets/" + identifier + "/content").content == original
