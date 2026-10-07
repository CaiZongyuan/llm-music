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


def test_cancel_dispatch_preserves_running_until_target_terminal_confirmation(tmp_path: Path, monkeypatch) -> None:
    with cancellation_peer(tmp_path, monkeypatch) as (url, receipt_path, registry):
        configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        with TestClient(create_app(configured, registry=registry)) as client, httpx.Client(base_url=url, trust_env=False) as peer:
            peer.post("/control", json={"action": "scenario", "value": "delayed_confirmation"}).raise_for_status()
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + submitted["id"]
            wait_running(client, address)
            pending = client.post(address + "/cancel")
            assert pending.status_code == 202, pending.text
            assert pending.json()["status"] == "running"
            assert pending.json()["cancel_requested"] is True
            assert pending.json()["result"] is None
            for _ in range(2):
                current = client.get(address).json()
                assert current["status"] == "running"
                assert current["cancel_requested"] is True
                assert current["result"] is None
            assert peer.get("/facts").json()["foreign_state"] == "queued"
            peer.post("/control", json={"action": "confirm_cancellation"}).raise_for_status()
            final = terminal(client, address)
            assert final["status"] == "cancelled", final
            assert final["cancel_requested"] is True
            assert final["error"]["code"] == "cancelled"
            assert client.get(base + "/assets").json() == [reference]
            assert peer.get("/facts").json()["foreign_state"] == "running"
            peer.post("/control", json={"action": "finish_survivor"}).raise_for_status()


def test_owned_pending_removal_preserves_foreign_running_without_requiring_interrupted_history(tmp_path: Path, monkeypatch) -> None:
    with cancellation_peer(tmp_path, monkeypatch) as (url, receipt_path, registry):
        configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        with TestClient(create_app(configured, registry=registry)) as client, httpx.Client(base_url=url, trust_env=False) as peer:
            peer.post("/control", json={"action": "scenario", "value": "queued"}).raise_for_status()
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            original = reference_audio()
            reference = client.post(base + "/assets", files={"file": ("reference.wav", original)}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + submitted["id"]
            deadline = time.monotonic() + 5
            while peer.get("/facts").json()["target_states"].get("native-1") != "queued":
                assert time.monotonic() < deadline
                time.sleep(0.01)
            cancelled = client.post(address + "/cancel")
            assert cancelled.status_code == 200, cancelled.text
            assert cancelled.json()["status"] == "cancelled"
            assert cancelled.json()["result"] is None
            assert client.get(address).json() == cancelled.json()
            assert client.post(address + "/cancel").json() == cancelled.json()
            assert peer.get("/facts").json()["target_states"]["native-1"] == "removed_pending"
            assert peer.get("/history/native-1").json() == {}
            assert peer.get("/facts").json()["foreign_state"] == "running"
            assert client.get(base + "/assets").json() == [reference]
            assert client.get(base + "/assets/" + reference["id"] + "/content").content == original
            peer.post("/control", json={"action": "finish_survivor"}).raise_for_status()


def test_pending_target_starting_during_delete_requires_a_new_explicit_cancel(tmp_path: Path, monkeypatch) -> None:
    with cancellation_peer(tmp_path, monkeypatch) as (url, receipt_path, registry):
        configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        with TestClient(create_app(configured, registry=registry)) as client, httpx.Client(base_url=url, trust_env=False) as peer:
            peer.post("/control", json={"action": "scenario", "value": "queued_to_running"}).raise_for_status()
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + submitted["id"]
            deadline = time.monotonic() + 5
            while peer.get("/facts").json()["target_states"].get("native-1") != "queued":
                assert time.monotonic() < deadline
                time.sleep(0.01)
            raced = client.post(address + "/cancel")
            assert raced.status_code == 409, raced.text
            assert raced.json()["error"]["code"] == "cancellation_not_dispatched"
            still_running = wait_running(client, address)
            assert still_running["cancel_requested"] is False
            assert still_running["result"] is None
            assert peer.get("/facts").json()["foreign_state"] == "completed"
            retry_cancel = client.post(address + "/cancel")
            assert retry_cancel.status_code in {200, 202}, retry_cancel.text
            final = terminal(client, address)
            assert final["status"] == "cancelled"
            assert peer.get("/facts").json()["foreign_state"] == "completed"
            assert client.get(base + "/assets").json() == [reference]
