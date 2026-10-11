"""Owned CPU Runtime observations; production FastAPI projects all HTTP responses."""

import asyncio
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import run_api
from music_api.config import Settings
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from music_api.runtime_types import ModelEvidence, RuntimeAttestation, RuntimeObservation, RuntimeStatus
from music_api.workflow_registry import WorkflowRegistry


Scenario = Literal["ready", "stable-evidence", "missing", "downloading", "invalid", "unknown", "stale", "future", "unavailable", "expire", "empty", "loading", "api-error", "queue"]


class FixtureState(BaseModel):
    scenario: Scenario


class ObservationRegistry(WorkflowRegistry):
    scenario: Scenario = "ready"

    def requirements(self):
        value = super().requirements()
        return replace(value, models=()) if self.scenario == "empty" else value


class ObservationRuntime(FakeInferenceRuntime):
    """Synthetic source facts at the Runtime seam, not copied HTTP responses."""

    def __init__(self, registry: ObservationRegistry) -> None:
        super().__init__(registry=registry, max_age_seconds=3)
        self.source_time = datetime.now(timezone.utc)

    def health(self) -> RuntimeObservation:
        value = super().health()
        scenario = self.registry.scenario
        if scenario in {"unknown", "empty"}:
            return value
        now = datetime.now(timezone.utc)
        when = now - timedelta(seconds=600) if scenario == "stale" else self.source_time if scenario == "expire" else now
        if scenario == "future":
            when = now + timedelta(hours=1)
        evidence_when = self.source_time - timedelta(seconds=600) if scenario == "stable-evidence" else when
        requirements = self.registry.requirements()
        model_state = scenario if scenario in {"missing", "downloading", "invalid"} else "ready"
        reasons = () if model_state == "ready" else ("model_" + model_state,)
        models = tuple(ModelEvidence(model.id, model_state, "Explicit synthetic CPU model verification", evidence_when,
                                    model.sha256 if model_state == "ready" else None, reasons) for model in requirements.models)
        attestation = RuntimeAttestation("fake", "No native endpoint: isolated CPU observations", "Explicit synthetic CPU owner evidence", evidence_when,
                                        True, requirements.runtime_revision, requirements.plugin_revision, models)
        stats = {"system": {"comfyui_version": "synthetic-CPU-display", "python_version": requirements.python_version,
                            "pytorch_version": requirements.torch_version, "ram_total": 16 * 1024**3, "ram_free": 10 * 1024**3},
                 "devices": [{"name": "Synthetic CPU display GPU (not a device measurement)", "type": "cuda", "index": 0,
                              "vram_total": 8 * 1024**3, "vram_free": 6 * 1024**3, "torch_vram_total": 2 * 1024**3,
                              "torch_vram_free": 1024**3}]}
        return replace(value, source="Explicit synthetic CPU Runtime observations", observed_at=when,
                       reachable=scenario != "unavailable", system_stats=stats, system_stats_observed_at=when,
                       registered_nodes_observed_at=when, attestation=attestation,
                       reasons=("runtime_unavailable",) if scenario == "unavailable" else ())

    def status(self, handle: str) -> RuntimeStatus:
        if self.registry.scenario == "queue" and handle not in self._cancelled:
            return RuntimeStatus("running", phase="transcribing", progress=None)
        return super().status(handle)


def controlled_app(settings: Settings):
    registry = ObservationRegistry()
    runtime = ObservationRuntime(registry)
    configured = settings.model_copy(update={"diagnostics_max_age_seconds": 3})
    app = create_app(configured, runtime=runtime, registry=registry)

    @app.post("/__runtime_fixture")
    def control(state: FixtureState):
        registry.scenario = state.scenario
        runtime.source_time = datetime.now(timezone.utc)
        return {"scenario": registry.scenario, "scope": "owned CPU Runtime source fixture; no native GPU"}

    @app.middleware("http")
    async def controlled_transport(request: Request, call_next):
        observed = request.url.path in {"/health", "/runtime/diagnostics", "/runtime/models", "/runtime/capabilities", "/settings/metadata"}
        if observed and registry.scenario == "api-error":
            return JSONResponse({"error": {"code": "cpu_fixture_transport_unavailable", "message": "Owned CPU outage fixture.", "recovery": "Reset this isolated fixture."}}, status_code=503)
        if observed and registry.scenario == "loading":
            await asyncio.sleep(1.2)
        return await call_next(request)

    return app


if __name__ == "__main__":
    # Reuse the existing owned-process runner, logging and graceful stop receipt.
    run_api.create_app = controlled_app
    run_api.main()
