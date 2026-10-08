"""Observe the actual Cover graph and frozen recovery at an owned CPU HTTP peer."""

from dataclasses import replace
from datetime import datetime, timezone
import hashlib
import io
from pathlib import Path
import subprocess
import tarfile
import time

import httpx
import pytest

import evidence_fixture
from evidence_fixture import bound_evidence, write_registry_fixture
from music_api.runtime_evidence import ModelFingerprint, ModelReceipt
from native_event_peer import PEER_SOURCE
from test_cover import SELECTED, EFFECTIVE, selected_inputs
from test_generation_versions import INPUTS, wait_job
from test_restart_recovery import ORDINARY_RECOVERY, owned_api
from test_transcription import reference_audio


COVER_PEER = PEER_SOURCE.replace('payloads["/object_info"]["YuE2GenerateSong"] =',
    'payloads["/object_info"]["YuE2Options"] = {"input":{"required":{"cot":[["full","melody","off"],{}]}}}\npayloads["/object_info"]["YuE2GenerateSong"] =')
COVER_PEER = COVER_PEER.replace('@app.get("/fixture/selected-inputs")',
    '@app.get("/fixture/cover-graphs")\ndef cover_graphs():\n    return [item["graph"] for item in native.values()]\n\n@app.get("/fixture/selected-inputs")')


@pytest.mark.parametrize("mode,expected,archived", [("melody", EFFECTIVE, False), ("full", SELECTED, False), ("melody", EFFECTIVE, True)])
def test_cover_native_cot_effective_score_and_active_restart_keep_the_selected_mode(tmp_path: Path, monkeypatch, mode, expected, archived) -> None:
    monkeypatch.setattr(evidence_fixture, "PEER_SOURCE", COVER_PEER)
    with bound_evidence(tmp_path) as (url, requirements, receipt, receipt_path, _, _):
        fixture = replace(requirements.models[0], id="yue2-bf16", name="CPU bytes, not weights", filename="checkpoints/yue2_3b_bf16.safetensors", local_path="checkpoints/yue2_3b_bf16.safetensors")
        model = receipt.models_root / fixture.local_path
        model.parent.mkdir(parents=True)
        model.write_bytes(b"abc")
        facts, now = model.stat(), datetime.now(timezone.utc)
        verified = ModelReceipt(id=fixture.id, state="ready", revision=fixture.revision, checked_at=now, actual_sha256=hashlib.sha256(b"abc").hexdigest(), actual_size_bytes=3,
                               fingerprint=ModelFingerprint(resolved_path=model.resolve(), size_bytes=3, mtime_ns=facts.st_mtime_ns))
        requirements = replace(requirements, models=(*requirements.models, fixture))
        receipt_path.write_text(receipt.model_copy(update={"checked_at": now, "models": [*receipt.models, verified]}).model_dump_json(), encoding="utf-8")
        registry = tmp_path / "registry"
        write_registry_fixture(registry, requirements)
        data = tmp_path / "application"
        first_options = dict(ORDINARY_RECOVERY)
        if archived:
            baseline = tmp_path / "shipped-cover-v1"
            baseline.mkdir()
            archive = subprocess.check_output(["git", "-C", str(Path(__file__).resolve().parents[3]), "archive",
                                               "0834627eaaea4b832fca2f80956d5eced9d11797", "services/api/src"])
            with tarfile.open(fileobj=io.BytesIO(archive)) as content:
                content.extractall(baseline, filter="data")
            first_options["PYTHONPATH"] = str(baseline / "services/api/src")
        with httpx.Client(base_url=url, timeout=5, trust_env=False) as peer:
            with owned_api(data, url, receipt_path, registry, tmp_path, first_options) as client:
                project = client.post("/projects", json={"name": "Morning cover"}).json()
                base = "/projects/" + project["id"]
                reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
                transcription = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]})
                assert transcription.status_code == 202, transcription.text
                deadline = time.monotonic() + 10
                while peer.get("/fixture/state").json()["accepted"] != 1:
                    assert time.monotonic() < deadline
                    time.sleep(.02)
                peer.post("/fixture/control", json={"action": "complete"}).raise_for_status()
                completed = wait_job(client, project["id"], transcription.json()["id"])
                assert completed["status"] == "completed", completed
                saved = client.post(base + "/scores", json={"abc": SELECTED, "source_score_id": completed["result"]["score_id"]}).json()
                inputs = dict(selected_inputs(reference, saved), mode=mode, effective_abc_sha256=hashlib.sha256(expected.encode()).hexdigest())
                submitted = client.post(base + "/jobs/cover", json=inputs)
                assert submitted.status_code == 202, submitted.text
                while peer.get("/fixture/state").json()["accepted"] != 2:
                    assert time.monotonic() < deadline
                    time.sleep(.02)
                graph = peer.get("/fixture/cover-graphs").json()[-1]
                options = next(node["inputs"] for node in graph.values() if node["class_type"] == "YuE2Options")
                music = next(node["inputs"] for node in graph.values() if node["class_type"] == "YuE2GenerateSong")
                assert options["cot"] == mode and options["transpose"] == 0
                assert music["score_abc"] == expected
                running = client.get(base + "/jobs/" + submitted.json()["id"]).json()
                assert running["provenance"]["selected_score"]["effective_abc"] == expected
                assert running["provenance"]["settings"]["cot"] == mode
                assert running["provenance"]["workflow_version"] == ("1.0.0" if archived else "2.0.0")
            with owned_api(data, url, receipt_path, registry, tmp_path, ORDINARY_RECOVERY) as client:
                peer.post("/fixture/control", json={"action": "complete"}).raise_for_status()
                completed = wait_job(client, project["id"], submitted.json()["id"])
                assert completed["status"] == "completed", completed
                assert peer.get("/fixture/state").json()["accepted"] == 2
                assert completed["inputs"] == running["inputs"]
                for key in ("workflow_id", "workflow_version", "manifest_sha256", "definition_sha256", "settings", "selected_score", "cover_source"):
                    assert completed["provenance"][key] == running["provenance"][key]
                assert client.get(base + "/assets/" + completed["result"]["abc_asset_id"] + "/content").text == expected
                version = client.post(base + "/versions", json={"candidate_id": completed["result"]["candidate_id"], "name": "Recovered " + mode})
                assert version.status_code == 201
                assert version.json()["inputs"]["mode"] == mode
