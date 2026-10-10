"""Explicit retries preserve history and require proof that native work is safe to repeat."""

from pathlib import Path
import json
import time

from fastapi.testclient import TestClient
import httpx
import pytest

import cancellation_peer as peer_fixture

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


@pytest.mark.parametrize("read_delay",[0,2.6],ids=["immediate-owned-result","delayed-owned-result"])
def test_unexpected_error_after_native_acceptance_cannot_authorize_duplicate_retry(tmp_path: Path, monkeypatch,read_delay) -> None:
    # Measure actual GETs for the new owned attempt, independent of total host time.
    extension = "history_reads = []\n" + peer_fixture.CANCELLATION_EXTENSION
    extension = extension.replace('if self.path == "/queue":',
        'if self.path.startswith("/history/native-2"):\n            history_reads.append(self.path)\n'
        f'            if {read_delay}: __import__("time").sleep({read_delay})\n        if self.path == "/queue":',1)
    extension = extension.replace('self.reply({"foreign_state":foreign_state,',
        'self.reply({"history_reads":list(history_reads),"foreign_state":foreign_state,',1)
    monkeypatch.setattr(peer_fixture,"CANCELLATION_EXTENSION",extension)
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
            peer.post("/control", json={"action": "finish_target"}).raise_for_status()
            peer.post("/control", json={"action": "finish_survivor"}).raise_for_status()
            confirmed_retry = client.post(address + "/retry")
            assert confirmed_retry.status_code == 202, confirmed_retry.text
            new = confirmed_retry.json()
            assert new["id"] != failed["id"]
            assert new["inputs"] == failed["inputs"]
            new_address = base + "/jobs/" + new["id"]
            if read_delay:
                # One imposed 2.6s read plus OS/SQL/import work is not a <5s promise.
                # Correctness is bounded by normal provider capacity and exact GET count.
                deadline = time.monotonic() + configured.runtime_timeout_seconds
                while True:
                    response = client.get(new_address)
                    assert response.status_code == 200
                    complete = response.json()
                    if complete["status"] in {"completed","failed","cancelled"}:
                        break
                    assert time.monotonic() < deadline, {"job":complete,"native":peer.get("/facts").json()}
                    time.sleep(0.01)
            else:
                complete = terminal(client,new_address)  # Original five-second control.
            assert complete["status"] == "completed",complete
            assert complete["error"] is None
            facts = peer.get("/facts").json()
            assert facts["history_reads"].count("/history/native-2") == 1,facts
            assert client.get(address).json() == failed
            assert peer.get("/accepted").json()["count"] == 2
            (tmp_path/"retry-observation.json").write_text(json.dumps({"read_delay_seconds":read_delay,
                "observation_budget_seconds":configured.runtime_timeout_seconds if read_delay else 5,
                "history_reads":facts["history_reads"],"original":failed,"retried":complete,
                "native_acceptances":2}),encoding="utf-8")


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
            history = client.get(base + "/jobs")
            assert history.status_code == 200, history.text
            found = [job for job in history.json() if job["provenance"].get("retry_of_job_id") == cancelled["id"]]
            assert found == [complete]


def test_application_pending_cancel_never_dispatches_and_explicit_retry_has_a_new_native_attempt(tmp_path: Path, monkeypatch) -> None:
    with cancellation_peer(tmp_path, monkeypatch) as (url, receipt_path, registry):
        configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        with TestClient(create_app(configured, registry=registry)) as client, httpx.Client(base_url=url, trust_env=False) as peer:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
            first = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            first_address = base + "/jobs/" + first["id"]
            wait_running(client, first_address)
            pending = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + pending["id"]
            cancelled = client.post(address + "/cancel")
            assert cancelled.status_code == 200
            original = cancelled.json()
            assert original["status"] == "cancelled"
            assert original["inputs"] == pending["inputs"]
            assert original["provenance"] == pending["provenance"]
            assert peer.get("/accepted").json()["count"] == 1
            retried = client.post(address + "/retry")
            assert retried.status_code == 202, retried.text
            replacement = retried.json()
            assert replacement["id"] != original["id"]
            assert replacement["inputs"] == original["inputs"]
            assert peer.get("/accepted").json()["count"] == 1
            client.post(first_address + "/cancel").raise_for_status()
            peer.post("/control", json={"action": "finish_survivor"}).raise_for_status()
            complete = terminal(client, base + "/jobs/" + replacement["id"])
            assert complete["status"] == "completed", complete
            assert client.get(address).json() == original
            assert peer.get("/accepted").json()["count"] == 2
            assert len(set(peer.get("/accepted-attempts").json())) == 2
            assert client.get(base + "/assets/" + complete["result"]["abc_asset_id"] + "/content").status_code == 200


def test_known_rejection_retries_only_after_current_readiness_with_original_history_unchanged(tmp_path: Path, monkeypatch) -> None:
    with cancellation_peer(tmp_path, monkeypatch) as (url, receipt_path, registry):
        configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        with TestClient(create_app(configured, registry=registry)) as client, httpx.Client(base_url=url, trust_env=False) as peer:
            peer.post("/control", json={"action": "scenario", "value": "reject"}).raise_for_status()
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + submitted["id"]
            rejected = terminal(client, address)
            assert rejected["status"] == "failed"
            assert rejected["error"]["code"] == "workflow_invalid"
            assert rejected["recovery_required"] is False
            assert "INTERNAL" not in json.dumps(rejected)
            assert peer.get("/accepted").json()["count"] == 0
            current_receipt = receipt_path.read_bytes()
            foreign = json.loads(current_receipt)
            foreign["process"]["create_time"] -= 1
            receipt_path.write_text(json.dumps(foreign), encoding="utf-8")
            blocked = client.post(address + "/retry")
            assert blocked.status_code == 503, blocked.text
            assert blocked.json()["error"]["code"] == "runtime_process_identity_changed"
            assert client.get(address).json() == rejected
            assert peer.get("/accepted").json()["count"] == 0
            receipt_path.write_bytes(current_receipt)
            peer.post("/control", json={"action": "scenario", "value": "success"}).raise_for_status()
            retried = client.post(address + "/retry")
            assert retried.status_code == 202, retried.text
            replacement = retried.json()
            assert replacement["id"] != rejected["id"]
            assert replacement["inputs"] == rejected["inputs"]
            assert replacement["provenance"]["retry_of_job_id"] == rejected["id"]
            assert terminal(client, base + "/jobs/" + replacement["id"])["status"] == "completed"
            assert client.get(address).json() == rejected
            assert peer.get("/accepted").json()["count"] == 1
