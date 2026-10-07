"""Native phase bytes reach public application WS; lost subscription recovers by HTTP."""

import base64
from dataclasses import replace
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import time

from fastapi.testclient import TestClient
import httpx
import pytest

import evidence_fixture
from evidence_fixture import bound_evidence, write_registry_fixture
from native_event_peer import PEER_SOURCE
from music_api.config import Settings
from music_api.main import create_app
from music_api.workflow_registry import WorkflowRegistry
from music_api.runtime_evidence import ModelFingerprint, ModelReceipt
from test_transcription import reference_audio


@pytest.mark.parametrize("operation", ["Transcribe", "Generate"])
def test_native_phase_subscription_loss_and_missing_completion_event_recover_one_owned_result(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, operation: str) -> None:
    monkeypatch.setattr(evidence_fixture, "PEER_SOURCE", PEER_SOURCE)
    with bound_evidence(tmp_path) as (url, requirements, receipt, receipt_path, _, _):
        if operation == "Generate":
            fixture = replace(requirements.models[0], id="yue2-bf16", name="CPU YuE2 fixture, not weights",
                              filename="checkpoints/yue2_3b_bf16.safetensors", local_path="checkpoints/yue2_3b_bf16.safetensors")
            model = receipt.models_root / fixture.local_path
            model.parent.mkdir(parents=True)
            model.write_bytes(b"abc")
            digest, facts = hashlib.sha256(model.read_bytes()).hexdigest(), model.stat()
            now = datetime.now(timezone.utc)
            verification = ModelReceipt(id=fixture.id, state="ready", revision=fixture.revision, checked_at=now,
                                        actual_sha256=digest, actual_size_bytes=facts.st_size,
                                        fingerprint=ModelFingerprint(resolved_path=model.resolve(), size_bytes=facts.st_size, mtime_ns=facts.st_mtime_ns))
            requirements = replace(requirements, models=(*requirements.models, fixture))
            receipt = receipt.model_copy(update={"checked_at": now, "models": [*receipt.models, verification]})
            receipt_path.write_text(receipt.model_dump_json(), encoding="utf-8")
        root = tmp_path / "registry"
        write_registry_fixture(root, requirements)
        registry = WorkflowRegistry(root)
        settings = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        with httpx.Client(base_url=url, timeout=5, trust_env=False) as peer, TestClient(create_app(settings, registry=registry)) as client:
            deadline = time.monotonic() + 10
            while True:
                try:
                    if peer.get("/fixture/state").status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                assert time.monotonic() < deadline
                time.sleep(0.02)
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            source = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
            if operation == "Transcribe":
                submitted = client.post(base + "/transcriptions", json={"reference_asset_id": source["id"]})
            else:
                submitted = client.post(base + "/jobs/generate", json={"style": "gentle folk pop", "lyrics": "Morning gathers on the window", "seed": 2026192201})
            assert submitted.status_code == 202, submitted.text
            job_url = base + "/jobs/" + submitted.json()["id"]
            with client.websocket_connect(job_url + "/events") as websocket:
                deadline = time.monotonic() + 5
                while peer.get("/fixture/state").json()["connected"] != 1:
                    assert time.monotonic() < deadline
                    time.sleep(0.01)
                # TEXT=3; ten UTF-8 bytes "transcribe"; exact pinned SheetSage caption.
                encoded = bytes.fromhex("000000030000000a7472616e7363726962654c6f6164696e672053686565745361676532" if operation == "Transcribe" else
                                        "00000003000000013257726974696e67207468652073636f7265")
                peer.post("/fixture/control", json={"action": "emit", "binary": base64.b64encode(encoded).decode()}).raise_for_status()
                while True:
                    observed = websocket.receive_json()["job"]
                    assert "native-owned-" not in json.dumps(observed)
                    assert observed["progress"] is None
                    if observed["phase"] == ("loading_model" if operation == "Transcribe" else "planning_score"):
                        assert observed["status"] == "running"
                        break
                peer.post("/fixture/control", json={"action": "disconnect"}).raise_for_status()
                peer.post("/fixture/control", json={"action": "complete"}).raise_for_status()
                while True:
                    completed = websocket.receive_json()["job"]
                    if completed["status"] in {"completed", "failed", "cancelled"}:
                        break
                assert completed["status"] == "completed", completed
            assert client.get(job_url).json() == completed
            with client.websocket_connect(job_url + "/events") as websocket:
                assert websocket.receive_json()["job"] == completed
            assert peer.get("/fixture/state").json()["accepted"] == 1
            assert len(client.get(base + "/assets").json()) == 3
            assert len(client.get(base + "/scores").json()) == 1
            assert client.get(base + "/assets/" + source["id"] + "/content").content == reference_audio()
            for role in (("abc", "midi") if operation == "Transcribe" else ("abc", "audio")):
                assert client.get(base + "/assets/" + completed["result"][role + "_asset_id"] + "/content").content
