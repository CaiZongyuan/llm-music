"""Native HTTP mapping and active restart run only against an identified CPU peer."""

from dataclasses import replace
from datetime import datetime, timezone
import hashlib
from pathlib import Path
import time

import httpx

import evidence_fixture
from evidence_fixture import bound_evidence, write_registry_fixture
from music_api.runtime_evidence import ModelFingerprint, ModelReceipt
from native_event_peer import PEER_SOURCE
from test_generate_from_score import SELECTED_ABC
from test_generation_versions import INPUTS, wait_job
from test_restart_recovery import ORDINARY_RECOVERY, owned_api


def test_native_selected_input_mapping_and_active_restart_recover_without_resubmission(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(evidence_fixture, "PEER_SOURCE", PEER_SOURCE)
    with bound_evidence(tmp_path) as (url, requirements, receipt, receipt_path, _, _):
        fixture = replace(requirements.models[0], id="yue2-bf16", name="CPU bytes, not model weights",
                          filename="checkpoints/yue2_3b_bf16.safetensors", local_path="checkpoints/yue2_3b_bf16.safetensors")
        model = receipt.models_root / fixture.local_path
        model.parent.mkdir(parents=True)
        model.write_bytes(b"abc")
        facts, now = model.stat(), datetime.now(timezone.utc)
        verification = ModelReceipt(id=fixture.id, state="ready", revision=fixture.revision, checked_at=now,
            actual_sha256=hashlib.sha256(b"abc").hexdigest(), actual_size_bytes=3,
            fingerprint=ModelFingerprint(resolved_path=model.resolve(), size_bytes=3, mtime_ns=facts.st_mtime_ns))
        requirements = replace(requirements, models=(*requirements.models, fixture))
        receipt_path.write_text(receipt.model_copy(update={"checked_at": now, "models": [*receipt.models, verification]}).model_dump_json(), encoding="utf-8")
        registry = tmp_path / "registry"
        write_registry_fixture(registry, requirements)
        data = tmp_path / "application"
        with httpx.Client(base_url=url, timeout=5, trust_env=False) as peer:
            with owned_api(data, url, receipt_path, registry, tmp_path, ORDINARY_RECOVERY) as client:
                project = client.post("/projects", json={"name": "Morning song"}).json()
                base = "/projects/" + project["id"]
                source = client.post(base + "/jobs/generate", json=INPUTS).json()
                deadline = time.monotonic() + 10
                while peer.get("/fixture/state").json()["accepted"] != 1:
                    assert time.monotonic() < deadline
                    time.sleep(0.02)
                peer.post("/fixture/control", json={"action": "complete"}).raise_for_status()
                generated = wait_job(client, project["id"], source["id"])
                assert generated["status"] == "completed", generated
                parent = client.post(base + "/versions", json={"candidate_id": generated["result"]["candidate_id"], "name": "Original morning"}).json()
                selected = dict(INPUTS, abc=SELECTED_ABC, source_score_id=parent["score_id"], parent_version_id=parent["id"])
                submitted = client.post(base + "/jobs/generate-from-score", json=selected)
                assert submitted.status_code == 202, submitted.text
                selected_id = submitted.json()["id"]
                while peer.get("/fixture/state").json()["accepted"] != 2:
                    assert time.monotonic() < deadline
                    time.sleep(0.02)
                assert peer.get("/fixture/selected-inputs").json() == [dict(abc=SELECTED_ABC, **INPUTS)]
                running = client.get(base + "/jobs/" + selected_id).json()
                assert running["inputs"] == dict(selected, max_seconds=0)
            with owned_api(data, url, receipt_path, registry, tmp_path, ORDINARY_RECOVERY) as client:
                peer.post("/fixture/control", json={"action": "complete"}).raise_for_status()
                completed = wait_job(client, project["id"], selected_id)
                assert completed["status"] == "completed", completed
                assert completed["inputs"] == running["inputs"]
                assert peer.get("/fixture/state").json()["accepted"] == 2
                candidate = client.get(base + "/candidates/" + completed["result"]["candidate_id"]).json()
                assert candidate["provenance"]["selected_score"] == running["provenance"]["selected_score"]
                assert client.get(base + "/assets/" + completed["result"]["abc_asset_id"] + "/content").content == SELECTED_ABC.encode()
                audio = client.get(base + "/assets/" + candidate["audio_asset_id"]).json()
                assert audio["format"] == "flac" and audio["sample_rate"] == 48000 and audio["channels"] == 2
                assert audio["duration_seconds"] > 30
                assert client.get(base + "/versions").json() == [parent]
                saved = client.post(base + "/versions", json={"candidate_id": candidate["id"], "name": "Recovered selection"})
                assert saved.status_code == 201, saved.text
                assert saved.json()["parent_version_id"] == parent["id"]
