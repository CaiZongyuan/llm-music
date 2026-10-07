"""Creators cancel and explicitly retry through isolated production HTTP."""

from pathlib import Path
import time

from fastapi.testclient import TestClient
import httpx

from cancellation_peer import cancellation_peer
from music_api.config import Settings
from music_api.main import create_app
from test_transcription import ABC, reference_audio, terminal


def wait_running(client: TestClient, address: str):
    deadline = time.monotonic() + 5
    while True:
        response = client.get(address)
        assert response.status_code == 200
        job = response.json()
        if job["status"] == "running":
            return job
        assert job["status"] == "queued", job
        assert time.monotonic() < deadline
        time.sleep(0.01)


def test_owned_running_cancel_is_terminal_only_with_native_evidence_and_successor_survives(tmp_path: Path, monkeypatch) -> None:
    with cancellation_peer(tmp_path, monkeypatch) as (url, receipt_path, registry):
        configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        with TestClient(create_app(configured, registry=registry)) as client, httpx.Client(base_url=url, trust_env=False) as peer:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            original = reference_audio()
            reference = client.post(base + "/assets", files={"file": ("reference.wav", original)}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]})
            assert submitted.status_code == 202
            address = base + "/jobs/" + submitted.json()["id"]
            before = wait_running(client, address)
            requested = client.post(address + "/cancel")
            assert requested.status_code in {200, 202}, requested.text
            cancelled = terminal(client, address)
            assert cancelled["status"] == "cancelled", cancelled
            assert cancelled["error"]["code"] == "cancelled"
            assert cancelled["inputs"] == before["inputs"]
            assert cancelled["provenance"] == before["provenance"]
            assert cancelled["result"] is None
            assert client.post(address + "/cancel").json() == cancelled
            assert peer.get("/facts").json()["foreign_state"] == "running"
            peer.post("/control", json={"action": "finish_survivor"}).raise_for_status()
            assert peer.get("/facts").json()["foreign_state"] == "completed"
            successor = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            complete = terminal(client, base + "/jobs/" + successor["id"])
            assert complete["status"] == "completed", complete
            assert client.get(base + "/assets/" + complete["result"]["abc_asset_id"] + "/content").content == ABC
            assert client.get(base + "/assets/" + complete["result"]["midi_asset_id"] + "/content").status_code == 200
            assert client.get(base + "/assets/" + reference["id"] + "/content").content == original
            assert client.get(address).json() == cancelled
            assert client.post(base + "/jobs/" + complete["id"] + "/cancel").json() == complete
