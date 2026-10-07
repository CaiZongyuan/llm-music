"""Diagnostics public HTTP uses isolated CPU peers, receipts and application data."""

from datetime import datetime, timedelta, timezone
from dataclasses import replace
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
import wave

import pytest

from fastapi.testclient import TestClient

from diagnostics_peer import diagnostics_peer
from evidence_fixture import bound_evidence, write_registry_fixture
from music_api.comfy_runtime import ComfyUIRuntime
from music_api.config import Settings
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from music_api.runtime_types import RuntimeObservation, RuntimeStatus
from music_api.workflow_registry import WorkflowRegistry


def supported_reference() -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
        writer.writeframes(b"\x10\x00" * 384000)
    return output.getvalue()


def test_old_ready_receipt_and_current_unreachable_cannot_authorize_work(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    source_time = datetime.now(timezone.utc) - timedelta(seconds=600)
    with diagnostics_peer(unavailable=True) as (url, peer):
        receipt = tmp_path / "historical-ready.json"
        receipt.write_text(json.dumps({
            "schema_version": 1, "mode": "comfyui", "runtime_url": url, "source": "isolated CPU fixture; historical prerequisites",
            "checked_at": source_time.isoformat(), "runtime_root": str(tmp_path / "runtime"), "models_root": str(tmp_path / "models"),
            "runtime_revision": "7a5dad695fe1cae25efcb2550530fb20ef68da3d", "plugin_revision": "fc78df9dfb214f396aa281f5b03519cefff5b00a",
            "process": {"pid": 1, "create_time": 1, "executable": "historical-python.exe", "entrypoint": "historical-main.py"},
            "models": [{"id": "sheetsage2-bf16", "state": "ready", "revision": "2f76ca75e6ee094169de899cc7fc99d6887e2196",
                        "checked_at": source_time.isoformat(), "actual_sha256": "5fd960ce3df281e3f3a889d174584d88f96247711480cf96377b12d7e8b6adc5",
                        "actual_size_bytes": 1386868122, "fingerprint": None}],
        }), encoding="utf-8")
        monkeypatch.setenv("MUSIC_API_RUNTIME_MODE", "comfyui")
        monkeypatch.setenv("MUSIC_API_RUNTIME_URL", url)
        monkeypatch.setenv("MUSIC_API_RUNTIME_EVIDENCE_PATH", str(receipt))
        with TestClient(create_app(Settings(data_dir=tmp_path / "application"))) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"] + "/assets"
            original = supported_reference()
            uploaded = client.post(base, files={"file": ("reference.wav", original)})
            assert uploaded.status_code == 201
            response = client.get("/runtime/capabilities")
            assert response.status_code == 200
            capability = next(item for item in response.json()["capabilities"] if item["operation"] == "Transcribe")
            assert capability["ready"] is False
            assert "runtime_unavailable" in [reason["code"] for reason in capability["reasons"]]
            models = client.get("/runtime/models").json()["models"]
            model = next(item for item in models if item["id"] == "sheetsage2-bf16")
            assert model["observation"]["freshness"] == "stale"
            assert model["observation"]["age_seconds"] >= 600
            assert datetime.fromisoformat(model["observation"]["observed_at"].replace("Z", "+00:00")) == source_time
            submitted = client.post("/projects/" + project["id"] + "/transcriptions", json={"reference_asset_id": uploaded.json()["id"]})
            assert submitted.status_code == 503
            assert submitted.json()["error"]["code"] == "runtime_unavailable"
            assert peer["writes"] == []
            assert client.get("/projects/" + project["id"]).json() == project
            assert client.get(base + "/" + uploaded.json()["id"] + "/content").content == original
            assert importlib.util.find_spec("torch") is None


def test_bound_plugin_models_remain_eligible_with_empty_generic_inventory_then_reject_changes(tmp_path: Path) -> None:
    with bound_evidence(tmp_path) as (url, requirements, _, receipt_path, model_file, writes):
        write_registry_fixture(tmp_path, requirements)
        registry = WorkflowRegistry(tmp_path)
        configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        runtime = ComfyUIRuntime(configured, registry)
        with TestClient(create_app(configured, runtime=runtime, registry=registry)) as client:
            capabilities = client.get("/runtime/capabilities").json()["capabilities"]
            transcribe = next(item for item in capabilities if item["operation"] == "Transcribe")
            assert transcribe["ready"] is True
            assert transcribe["reasons"] == []
            registered = client.get("/runtime/models").json()["models"][0]
            assert registered["state"] == "ready"
            assert registered["provider"] == "isolated fixture"
            assert registered["expected_sha256"] == registered["observed_sha256"]

            project = client.post("/projects", json={"name": "Morning song"}).json()
            asset = client.post("/projects/" + project["id"] + "/assets", files={"file": ("reference.wav", supported_reference())}).json()
            model_file.write_bytes(b"changed synthetic weights")
            capability = next(item for item in client.get("/runtime/capabilities").json()["capabilities"] if item["operation"] == "Transcribe")
            assert capability["ready"] is False
            changed = client.get("/runtime/models").json()["models"][0]
            assert changed["state"] == "unavailable"
            assert "model_fingerprint_changed" in [reason["code"] for reason in changed["reasons"]]
            submitted = client.post("/projects/" + project["id"] + "/transcriptions", json={"reference_asset_id": asset["id"]})
            assert submitted.status_code == 503
            assert submitted.json()["error"]["code"] == "model_unverified"
            model_file.unlink()
            missing = client.get("/runtime/models").json()["models"][0]
            assert missing["state"] == "missing"
            assert next(item for item in client.get("/runtime/capabilities").json()["capabilities"] if item["operation"] == "Transcribe")["ready"] is False
            assert not writes.exists()


def test_backend_health_reports_unreachable_runtime_without_gpu_dependency(tmp_path: Path) -> None:
    with diagnostics_peer(unavailable=True) as (url, _):
        settings = Settings(data_dir=tmp_path, runtime_mode="comfyui", runtime_url=url)
        with TestClient(create_app(settings)) as client:
            response = client.get("/health")
            assert response.status_code == 200
            health = response.json()
            assert health["backend"]["status"] == "ready"
            assert health["backend"]["scope"] == "application HTTP process"
            assert health["runtime"]["status"] == "unavailable"
            assert health["runtime"]["ready"] is False
            assert "runtime_unavailable" in [reason["code"] for reason in health["runtime"]["reasons"]]
            assert health["runtime"]["observation"]["source"] == url
            assert health["runtime"]["observation"]["max_age_seconds"] == 300
            assert client.get("/projects").json() == []


def test_diagnostics_keep_native_memory_scopes_and_unobserved_values_distinct(tmp_path: Path) -> None:
    with diagnostics_peer() as (url, _):
        with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="comfyui", runtime_url=url))) as client:
            response = client.get("/runtime/diagnostics")
            assert response.status_code == 200
            diagnostics = response.json()
            metrics = {item["name"]: item for item in diagnostics["memory"]}
            assert metrics["cuda_device_free_bytes"]["value"] == 6174015488
            assert metrics["cuda_device_used_bytes"]["value"] == 2415919104
            assert metrics["runtime_torch_active_bytes"]["value"] == 805306368
            assert metrics["runtime_torch_active_bytes"]["scope"] == "Runtime Torch active allocator; includes blocks awaiting free"
            assert all(item["unit"] == "bytes" for item in metrics.values())
            assert metrics["runtime_process_gpu_resident_bytes"]["value"] is None
            assert metrics["runtime_process_gpu_resident_bytes"]["availability"] == "unavailable"
            assert diagnostics["loaded_models"]["value"] is None
            assert diagnostics["loaded_models"]["availability"] == "unavailable"
            assert diagnostics["versions"]["pytorch"]["value"] == "2.10.0+cu130"
            assert diagnostics["versions"]["cuda"]["value"] is None
            assert metrics["cuda_device_free_bytes"]["observation"]["source"] == url + "/system_stats"


@pytest.mark.parametrize("scenario,code", [("no_gpu", "gpu_unavailable"), ("invalid_hash", "model_invalid"),
                                         ("old_stats", "runtime_system_facts_stale"), ("old_nodes", "runtime_node_facts_stale")])
def test_public_submit_uses_current_readiness_sources(tmp_path: Path, scenario: str, code: str) -> None:
    with bound_evidence(tmp_path) as (url, requirements, _, receipt_path, _, writes):
        write_registry_fixture(tmp_path, requirements)
        registry = WorkflowRegistry(tmp_path)
        settings = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)

        class SourceObservationFixture(ComfyUIRuntime):
            """An external observation at the public Runtime seam; common predicate is unchanged."""
            def health(self) -> RuntimeObservation:
                value = super().health()
                old = datetime.now(timezone.utc) - timedelta(seconds=600)
                if scenario == "old_stats":
                    return replace(value, system_stats_observed_at=old)
                if scenario == "old_nodes":
                    return replace(value, registered_nodes_observed_at=old)
                return value

        if scenario == "no_gpu":
            writes.with_suffix(".payloads.json").write_text(json.dumps({"/system_stats": {
                "system": {"python_version": "3.12.13", "pytorch_version": "2.10.0+cu130"}, "devices": []}}), encoding="utf-8")
        elif scenario == "invalid_hash":
            data = json.loads(receipt_path.read_bytes())
            data["models"][0]["actual_sha256"] = "0" * 64
            receipt_path.write_text(json.dumps(data), encoding="utf-8")
        runtime = SourceObservationFixture(settings, registry)
        with TestClient(create_app(settings, runtime=runtime, registry=registry)) as client:
            capability = next(item for item in client.get("/runtime/capabilities").json()["capabilities"] if item["operation"] == "Transcribe")
            assert capability["ready"] is False
            assert code in [reason["code"] for reason in capability["reasons"]]
            project = client.post("/projects", json={"name": "Morning song"}).json()
            asset = client.post("/projects/" + project["id"] + "/assets", files={"file": ("reference.wav", supported_reference())}).json()
            rejected = client.post("/projects/" + project["id"] + "/transcriptions", json={"reference_asset_id": asset["id"]})
            assert rejected.status_code == 503
            assert rejected.json()["error"]["code"] == code
            assert not writes.exists()
            if scenario == "invalid_hash":
                assert client.get("/runtime/models").json()["models"][0]["state"] == "invalid"
            if scenario == "old_stats":
                metrics = client.get("/runtime/diagnostics").json()["memory"]
                gpu_total = next(item for item in metrics if item["name"] == "cuda_device_total_bytes")
                assert gpu_total["availability"] == "unavailable"
                assert gpu_total["observation"]["freshness"] == "stale"
                assert gpu_total["observation"]["age_seconds"] >= 600
            if scenario == "old_nodes":
                nodes_source = client.get("/runtime/diagnostics").json()["source_observations"]["registered_nodes"]
                assert nodes_source["freshness"] == "stale"
                assert nodes_source["age_seconds"] >= 600


def test_settings_metadata_exports_real_defaults_and_environment_names(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, diagnostics_max_age_seconds=17))) as client:
        response = client.get("/settings/metadata")
        assert response.status_code == 200
        metadata = response.json()
        assert metadata["environment_prefix"] == "MUSIC_API_"
        assert metadata["environment_variables"]["diagnostics_max_age_seconds"] == "MUSIC_API_DIAGNOSTICS_MAX_AGE_SECONDS"
        policy = metadata["settings_schema"]["properties"]["diagnostics_max_age_seconds"]
        assert policy["default"] == 300
        assert policy["exclusiveMinimum"] == 0
        assert "Freshness policy" in policy["description"]
        assert "current_values" not in metadata


def test_fake_observation_respects_the_configured_freshness_policy(tmp_path: Path) -> None:
    registry = WorkflowRegistry()

    class OldSourceFake(FakeInferenceRuntime):
        def health(self) -> RuntimeObservation:
            return replace(super().health(), observed_at=datetime.now(timezone.utc) - timedelta(seconds=2))

    output = tmp_path / "fake-native-output"
    runtime = OldSourceFake(registry=registry, output_dir=output, max_age_seconds=1)
    settings = Settings(data_dir=tmp_path / "application", diagnostics_max_age_seconds=1)
    with TestClient(create_app(settings, runtime=runtime, registry=registry)) as client:
        capability = next(item for item in client.get("/runtime/capabilities").json()["capabilities"] if item["operation"] == "Transcribe")
        assert capability["ready"] is False
        assert capability["observation"]["freshness"] == "stale"
        assert capability["observation"]["max_age_seconds"] == 1
        assert "runtime_observation_stale" in [reason["code"] for reason in capability["reasons"]]
        project = client.post("/projects", json={"name": "Morning song"}).json()
        asset = client.post("/projects/" + project["id"] + "/assets", files={"file": ("reference.wav", supported_reference())}).json()
        rejected = client.post("/projects/" + project["id"] + "/transcriptions", json={"reference_asset_id": asset["id"]})
        assert rejected.status_code == 503
        assert rejected.json()["error"]["code"] == "runtime_observation_stale"
        assert not output.exists()


def test_diagnostics_report_application_queue_without_claiming_native_occupancy(tmp_path: Path) -> None:
    release = threading.Event()

    class HeldExternalRuntime(FakeInferenceRuntime):
        def status(self, handle: str) -> RuntimeStatus:
            return super().status(handle) if release.is_set() else RuntimeStatus("running", "transcribing")

    runtime = HeldExternalRuntime()
    try:
        with TestClient(create_app(Settings(data_dir=tmp_path), runtime=runtime)) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            asset = client.post("/projects/" + project["id"] + "/assets", files={"file": ("reference.wav", supported_reference())}).json()
            job = client.post("/projects/" + project["id"] + "/transcriptions", json={"reference_asset_id": asset["id"]}).json()
            deadline = time.monotonic() + 5
            while client.get("/projects/" + project["id"] + "/jobs/" + job["id"]).json()["status"] != "running":
                assert time.monotonic() < deadline
                time.sleep(0.01)
            diagnostics = client.get("/runtime/diagnostics").json()
            queue = diagnostics["application_queue"]
            assert queue["running"] == 1
            assert queue["queued"] == 0
            assert queue["jobs"][0]["id"] == job["id"]
            assert queue["recorded_running_job"]["value"] == job["id"]
            assert "persisted" in queue["scope"]
            assert diagnostics["native_queue_occupancy"]["value"] is None
            assert diagnostics["native_queue_occupancy"]["availability"] == "unavailable"
            assert "runtime_handle" not in json.dumps(queue)
            release.set()
    finally:
        release.set()


def test_exported_diagnostics_contract_needs_no_runtime_or_database(tmp_path: Path) -> None:
    with diagnostics_peer(unavailable=True) as (url, peer):
        data_dir, output = tmp_path / "not-created", tmp_path / "api.json"
        result = subprocess.run([sys.executable, "-m", "music_api", "openapi", "--data-dir", str(data_dir), "--output", str(output)],
                                capture_output=True, text=True, encoding="utf-8", timeout=15,
                                env={**os.environ, "MUSIC_API_RUNTIME_MODE": "comfyui", "MUSIC_API_RUNTIME_URL": url})
        assert result.returncode == 0, result.stderr
        assert not data_dir.exists()
        assert peer["reads"] == []
        contract = json.loads(output.read_bytes())
        for path in ["/health", "/runtime/capabilities", "/runtime/models", "/runtime/diagnostics", "/settings/metadata"]:
            assert path in contract["paths"]
        sources = contract["components"]["schemas"]["DiagnosticSource"]["properties"]
        assert {"source", "observed_at", "age_seconds", "freshness", "max_age_seconds"}.issubset(sources)
        memory = contract["components"]["schemas"]["MemoryMetricRead"]["properties"]
        assert {"value", "availability", "scope", "unit", "observation", "reasons"}.issubset(memory)
