"""Public diagnostics project the shared Runtime observations and readiness decision."""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Request

from music_api.config import Settings
from music_api.diagnostics_schemas import (CapabilitiesRead, CapabilityRead, CodeRegistryRead, DiagnosticReason,
                                         DiagnosticSource, ModelRead, ModelsRead)
from music_api.runtime_types import InferenceRuntime, RuntimeRequirements


router = APIRouter(tags=["Runtime diagnostics"])


def reason(code: str) -> DiagnosticReason:
    messages = {
        "runtime_unavailable": ("The Runtime is unreachable.", "Ask the Runtime owner to restore the configured local service, then refresh."),
        "runtime_evidence_stale": ("The owner receipt is outside the freshness window.", "Ask the Runtime owner to collect new evidence; saving an old receipt again does not refresh it."),
        "model_evidence_stale": ("The model verification is outside the freshness window.", "Ask the owner to verify the original weights and collect a new receipt."),
        "model_missing": ("A required model is missing.", "Ask the owner to restore the registered model and verify its pinned hash."),
        "gpu_unavailable": ("A usable Runtime GPU is unavailable.", "Ask the owner to restore the pinned GPU Runtime, then refresh."),
        "model_hash_invalid": ("The observed model hash or size differs from the pinned registry.", "Preserve the invalid file; ask the owner to restore the registered weights and verify them again."),
        "model_fingerprint_changed": ("The model file changed after its recorded hash verification.", "Treat the last hash as historical; ask the owner to verify the current original weights and collect a new receipt."),
        "model_layout_unavailable": ("The model file layout cannot be read.", "Ask the owner to restore model file access and collect a new receipt."),
        "model_revision_mismatch": ("The model revision differs from the pinned registry.", "Ask the owner to restore the registered model revision and verify its hash."),
        "model_verification_unavailable": ("Current model verification is unavailable.", "Ask the owner to collect a receipt for the registered weights and current Runtime."),
        "runtime_evidence_unavailable": ("An owner verification receipt is unavailable.", "Ask the owner to run the CPU receipt collector and configure its output path."),
        "runtime_evidence_invalid": ("The owner receipt cannot be validated.", "Retain the file and collect a new receipt using the documented schema and current Runtime."),
        "runtime_evidence_future": ("The owner receipt has a future source timestamp.", "Check the host clock and collect new evidence; do not edit an old receipt timestamp."),
        "model_evidence_future": ("The model verification has a future source timestamp.", "Check the host clock and repeat actual model verification."),
        "runtime_evidence_identity_mismatch": ("The receipt belongs to another Runtime endpoint.", "Configure the receipt for this Runtime, or collect new evidence for the configured endpoint."),
        "runtime_evidence_revision_mismatch": ("The receipt source revisions differ from the pinned registry.", "Preserve local changes and restore the registered Runtime/plugin revisions before collecting evidence."),
        "runtime_process_identity_changed": ("The current Runtime process differs from the receipt.", "Ask the owner to identify the actual current listener and collect new evidence."),
        "runtime_listener_identity_changed": ("The configured listener does not belong to the recorded Runtime process.", "Ask the owner to identify and restore the configured local Runtime before collecting evidence."),
        "runtime_model_layout_changed": ("The current Runtime model root differs from the receipt.", "Ask the owner to verify the actual configured model layout and collect a new receipt."),
        "runtime_source_revision_changed": ("The current source checkout differs from the clean pinned revision.", "Preserve local changes and restore the pinned checkout before collecting evidence."),
        "runtime_binding_unavailable": ("Current local process or source binding cannot be verified.", "Ask the owner to restore local process/source access; retain the old receipt as historical evidence."),
    }
    message, recovery = messages.get(code, ("Runtime prerequisites are not currently verified.",
                                           "Ask the Runtime owner to check source binding, pinned revisions and model verification, then refresh."))
    return DiagnosticReason(code=code, message=message, recovery=recovery)


def source(source_name: str, observed_at: datetime | None, now: datetime, max_age: float) -> DiagnosticSource:
    age = None if observed_at is None else (now - observed_at).total_seconds()
    freshness: Literal["fresh", "stale", "unavailable"] = "unavailable" if age is None or age < 0 else "stale" if age > max_age else "fresh"
    return DiagnosticSource(source=source_name, observed_at=observed_at,
                            age_seconds=None if age is None or age < 0 else age,
                            freshness=freshness, max_age_seconds=max_age)


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
                       reasons=[reason(code) for code in item.reasons])
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
