"""Explicit retries preserve history and require proof that native work is safe to repeat."""

from pathlib import Path

from fastapi.testclient import TestClient
import httpx

from cancellation_peer import cancellation_peer
from music_api.comfy_runtime import ComfyUIRuntime
from music_api.config import Settings
from music_api.main import create_app
from music_api.runtime_types import RuntimeRequest, SubmissionReceipt
from test_transcription import reference_audio, terminal
from test_cancel_retry import wait_running


class UnexpectedAcknowledgementLoss(ComfyUIRuntime):
    """An external Runtime seam fails unexpectedly after a real CPU peer accepts."""

    lost = False

    def submit(self, request: RuntimeRequest) -> SubmissionReceipt:
        receipt = super().submit(request)
        if not self.lost:
            self.lost = True
            raise RuntimeError("Injected unexpected failure after native acceptance")
        return receipt


def test_unexpected_error_after_native_acceptance_cannot_authorize_duplicate_retry(tmp_path: Path, monkeypatch) -> None:
    with cancellation_peer(tmp_path, monkeypatch) as (url, receipt_path, registry):
        configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        runtime = UnexpectedAcknowledgementLoss(configured, registry)
        with TestClient(create_app(configured, runtime=runtime, registry=registry)) as client, httpx.Client(base_url=url, trust_env=False) as peer:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            original = reference_audio()
            reference = client.post(base + "/assets", files={"file": ("reference.wav", original)}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + submitted["id"]
            failed = terminal(client, address)
            assert failed["status"] == "failed"
            assert failed["error"]["code"] == "runtime_unavailable"
            assert failed["recovery_required"] is True
            assert "Injected" not in str(failed)
            assert peer.get("/facts").json()["target_states"]["native-1"] == "running"
            for _ in range(2):
                blocked = client.post(address + "/retry")
                assert blocked.status_code == 409, blocked.text
                assert blocked.json()["error"]["code"] == "retry_unconfirmed"
                assert client.get(address).json() == failed
                assert peer.get("/accepted").json()["count"] == 1
            assert client.get(base + "/assets/" + reference["id"] + "/content").content == original


def test_explicit_retry_of_confirmed_cancel_creates_new_ids_and_retains_original_history(tmp_path: Path, monkeypatch) -> None:
    with cancellation_peer(tmp_path, monkeypatch) as (url, receipt_path, registry):
        configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        with TestClient(create_app(configured, registry=registry)) as client, httpx.Client(base_url=url, trust_env=False) as peer:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            original = reference_audio()
            reference = client.post(base + "/assets", files={"file": ("reference.wav", original)}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + submitted["id"]
            wait_running(client, address)
            client.post(address + "/cancel").raise_for_status()
            cancelled = terminal(client, address)
            assert cancelled["status"] == "cancelled"
            peer.post("/control", json={"action": "finish_survivor"}).raise_for_status()
            repeated = client.post(address + "/retry")
            assert repeated.status_code == 202, repeated.text
            retried = repeated.json()
            assert retried["id"] != cancelled["id"]
            assert retried["inputs"] == cancelled["inputs"]
            assert retried["provenance"]["retry_of_job_id"] == cancelled["id"]
            assert retried["cancel_requested"] is False
            complete = terminal(client, base + "/jobs/" + retried["id"])
            assert complete["status"] == "completed", complete
            assert complete["error"] is None
            assert client.get(address).json() == cancelled
            assert client.get(base + "/scores/" + complete["result"]["score_id"]).status_code == 200
            assert len(client.get(base + "/scores").json()) == 1
            assert client.get(base + "/assets/" + complete["result"]["abc_asset_id"] + "/content").status_code == 200
            assert client.get(base + "/assets/" + complete["result"]["midi_asset_id"] + "/content").status_code == 200
            assert client.get(base + "/assets/" + reference["id"] + "/content").content == original
            attempts = peer.get("/accepted-attempts").json()
            assert len(attempts) == 2
            assert attempts[0] != attempts[1]
