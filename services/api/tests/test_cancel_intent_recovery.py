"""A durable intent with a lost provider acknowledgement is not native dispatch proof."""

from pathlib import Path

from fastapi.testclient import TestClient
import httpx
from sqlalchemy import event
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from cancellation_peer import cancellation_peer
from music_api.config import Settings
from music_api.job_models import Job
from music_api.main import create_app
from test_cancel_retry import wait_running
from test_transcription import reference_audio, terminal


def test_lost_cancel_intent_ack_allows_a_safe_explicit_repeat_to_reach_its_target(tmp_path: Path, monkeypatch) -> None:
    armed = {"value": False, "fired": False}

    def lose_intent_ack(session: Session) -> None:
        if armed["value"] and any(isinstance(item, Job) and item.cancel_requested for item in session.identity_map.values()):
            armed["value"], armed["fired"] = False, True
            raise OperationalError("External cancellation-intent acknowledgement loss", None, RuntimeError("Provider acknowledgement lost"))

    with cancellation_peer(tmp_path, monkeypatch) as (url, receipt_path, registry):
        configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        with TestClient(create_app(configured, registry=registry)) as client, httpx.Client(base_url=url, trust_env=False) as peer:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            original = reference_audio()
            reference = client.post(base + "/assets", files={"file": ("reference.wav", original)}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + submitted["id"]
            before = wait_running(client, address)
            event.listen(Session, "after_commit", lose_intent_ack)
            try:
                armed["value"] = True
                lost = client.post(address + "/cancel")
                assert lost.status_code == 503
                assert armed["fired"]
            finally:
                event.remove(Session, "after_commit", lose_intent_ack)
            intent = client.get(address).json()
            assert intent["status"] == "running"
            assert intent["cancel_requested"] is True
            assert intent["recovery_required"] is True
            assert peer.get("/facts").json()["target_states"]["native-1"] == "running"
            repeated = client.post(address + "/cancel")
            assert repeated.status_code in {200, 202}, repeated.text
            cancelled = terminal(client, address)
            assert cancelled["status"] == "cancelled", cancelled
            assert cancelled["recovery_required"] is False
            assert cancelled["inputs"] == before["inputs"]
            assert cancelled["provenance"] == before["provenance"]
            assert client.post(address + "/cancel").json() == cancelled
            assert peer.get("/facts").json()["foreign_state"] == "running"
            assert peer.get("/accepted").json()["count"] == 1
            assert client.get(base + "/assets/" + reference["id"] + "/content").content == original
            peer.post("/control", json={"action": "finish_survivor"}).raise_for_status()
