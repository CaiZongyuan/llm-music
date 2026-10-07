"""Absence requires a readable queue, rather than a successful cancellation dispatch alone."""

from pathlib import Path
import time

from fastapi.testclient import TestClient
import httpx

from cancellation_peer import cancellation_peer
from music_api.config import Settings
from music_api.main import create_app
from test_transcription import reference_audio


def test_unreadable_queue_after_pending_delete_cannot_fabricate_terminal_cancellation(tmp_path: Path, monkeypatch) -> None:
    with cancellation_peer(tmp_path, monkeypatch) as (url, receipt_path, registry):
        configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        with TestClient(create_app(configured, registry=registry)) as client, httpx.Client(base_url=url, trust_env=False) as peer:
            peer.post("/control", json={"action": "scenario", "value": "malformed_after_delete"}).raise_for_status()
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + submitted["id"]
            deadline = time.monotonic() + 5
            while peer.get("/facts").json()["target_states"].get("native-1") != "queued":
                assert time.monotonic() < deadline
                time.sleep(0.01)
            response = client.post(address + "/cancel")
            assert response.status_code == 409, response.text
            assert response.json()["error"]["code"] == "cancellation_unconfirmed"
            current = client.get(address).json()
            assert current["status"] == "queued"
            assert current["recovery_required"] is True
            assert current["result"] is None
            assert peer.get("/facts").json()["target_states"]["native-1"] == "queued"
            assert peer.get("/facts").json()["foreign_state"] == "running"
