"""Public diagnostics project the shared Runtime observations and readiness decision."""

from datetime import datetime, timezone
import platform
from typing import Literal

from fastapi import APIRouter, Request
from sqlalchemy import select

from music_api.config import Settings
from music_api.database import Database
from music_api.diagnostics import build_diagnostics, observed_value, reason, source
from music_api.diagnostics_schemas import (ActiveApplicationJobRead, ApplicationQueueRead, BackendHealthRead, CapabilitiesRead, CapabilityRead, CodeRegistryRead,
                                         DiagnosticsRead, HealthRead, ModelRead, ModelsRead, RuntimeHealthRead, SettingsMetadataRead)
from music_api.runtime_types import InferenceRuntime, RuntimeRequirements
from music_api.job_models import Job


router = APIRouter(tags=["Runtime diagnostics"])


@router.get("/settings/metadata", response_model=SettingsMetadataRead)
def settings_metadata() -> SettingsMetadataRead:
    prefix = str(Settings.model_config.get("env_prefix", ""))
    return SettingsMetadataRead(source="music_api.config.Settings.model_json_schema", environment_prefix=prefix,
                                environment_variables={name: prefix + name.upper() for name in Settings.model_fields},
                                settings_schema=Settings.model_json_schema())


@router.get("/runtime/diagnostics", response_model=DiagnosticsRead)
def diagnostics(request: Request) -> DiagnosticsRead:
    runtime: InferenceRuntime = request.app.state.runtime
    settings: Settings = request.app.state.settings
    observation = runtime.health()
    now = datetime.now(timezone.utc)
    database: Database = request.app.state.database
    with database.sessions() as session:
        rows = list(session.scalars(select(Job).where(Job.status.in_(("queued", "running"))).order_by(Job.created_at, Job.id)))
        jobs = [ActiveApplicationJobRead.model_validate(dict(id=job.id, project_id=job.project_id, operation=job.operation,
                                         status=job.status, phase=job.phase,
                                         observation=source("Application persisted Job row", datetime.fromisoformat(job.updated_at),
                                                            now, settings.diagnostics_max_age_seconds))) for job in rows]
    running = [job for job in jobs if job.status == "running"]
    current = running[0] if len(running) == 1 else None
    queue = ApplicationQueueRead(scope="Application persisted active Job states; not native occupancy",
                                 queued=sum(job.status == "queued" for job in jobs), running=len(running), jobs=jobs,
                                 observation=source("Current application SQLite active Job query", now, now, settings.diagnostics_max_age_seconds),
                                 recorded_running_job=observed_value(None if current is None else str(current.id), "Last recorded application running Job",
                                    None if current is None else current.observation.observed_at, now, settings.diagnostics_max_age_seconds,
                                    "application_running_job_unavailable" if current is None else None))
    return build_diagnostics(observation, now, settings.diagnostics_max_age_seconds, queue)


@router.get("/health", response_model=HealthRead)
def health(request: Request) -> HealthRead:
    runtime: InferenceRuntime = request.app.state.runtime
    settings: Settings = request.app.state.settings
    observation = runtime.health()
    observed_capabilities = runtime.capabilities(observation)
    now = datetime.now(timezone.utc)
    ready = any(item.ready for item in observed_capabilities)
    codes = list(observation.reasons)
    if not ready:
        codes.extend(code for item in observed_capabilities for code in item.reasons)
    status: Literal["ready", "not_ready", "unavailable"] = "unavailable" if not observation.reachable else "ready" if ready else "not_ready"
    return HealthRead(checked_at=now, backend=BackendHealthRead(status="ready", scope="application HTTP process",
                     version=request.app.version, python_version=platform.python_version(),
                     observation=source("Current application HTTP response", now, now, settings.diagnostics_max_age_seconds)),
                     runtime=RuntimeHealthRead(mode=observation.mode, status=status, reachable=observation.reachable, ready=ready,
                     binding_verified=None if observation.attestation is None else observation.attestation.binding_verified,
                     observation=source(observation.source, observation.observed_at, now, settings.diagnostics_max_age_seconds),
                     reasons=[reason(code) for code in dict.fromkeys(codes)]))


@router.get("/runtime/capabilities", response_model=CapabilitiesRead)
def capabilities(request: Request) -> CapabilitiesRead:
    runtime: InferenceRuntime = request.app.state.runtime
    settings: Settings = request.app.state.settings
    observation = runtime.health()
    observed_capabilities = runtime.capabilities(observation)
    now = datetime.now(timezone.utc)
    return CapabilitiesRead(mode=observation.mode, checked_at=now, capabilities=[
        CapabilityRead(operation=item.operation, required_models=list(item.required_models), ready=item.ready,
                       observation=source(item.source, item.observed_at, now, settings.diagnostics_max_age_seconds),
                       reasons=[reason(code) for code in item.reasons], supported_modes=list(item.supported_modes))
        for item in observed_capabilities
    ])


@router.get("/runtime/models", response_model=ModelsRead)
def models(request: Request) -> ModelsRead:
    runtime: InferenceRuntime = request.app.state.runtime
    settings: Settings = request.app.state.settings
    requirements: RuntimeRequirements = request.app.state.registry.requirements()
    observation = runtime.health()
    now = datetime.now(timezone.utc)
    attestation = observation.attestation
    evidence = {} if attestation is None else {model.id: model for model in attestation.models}
    result = []
    for model in requirements.models:
        checked = evidence.get(model.id)
        codes = list(observation.reasons) if not observation.reachable else []
        if checked is None:
            codes.append("model_verification_unavailable")
        else:
            codes.extend(checked.reasons)
        metadata = source("owner receipt unavailable" if checked is None else checked.source,
                          None if checked is None else checked.checked_at, now, settings.diagnostics_max_age_seconds)
        state: Literal["missing", "downloading", "ready", "invalid", "unavailable"] = "unavailable" if checked is None or checked.state == "unknown" or not observation.reachable or metadata.freshness != "fresh" else checked.state
        result.append(ModelRead(id=model.id, name=model.name, provider=model.provider, repository=model.repository,
                                revision=model.revision, filename=model.filename, local_path=model.local_path,
                                registry_source=requirements.source, hash_source=model.hash_source,
                                components=list(model.components), component_license_notes=model.component_license_notes,
                                expected_sha256=model.sha256, expected_size_bytes=model.size_bytes,
                                weights_license=model.weights_license, license_source=model.license_source,
                                state=state, observed_sha256=None if checked is None else checked.sha256,
                                observation=metadata, reasons=[reason(code) for code in dict.fromkeys(codes)]))
    return ModelsRead(mode=observation.mode, checked_at=now, models=result, code_registry=[
        CodeRegistryRead(component="runtime", expected_revision=requirements.runtime_revision,
                         code_license=requirements.runtime_code_license, license_source=requirements.runtime_license_source,
                         registry_source=requirements.source),
        CodeRegistryRead(component="plugin", expected_revision=requirements.plugin_revision,
                         code_license=requirements.plugin_code_license, license_source=requirements.plugin_license_source,
                         registry_source=requirements.source),
    ])
