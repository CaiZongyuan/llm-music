"""Project source-labelled observations without inventing current Runtime facts."""

from collections.abc import Mapping
from datetime import datetime
from typing import Literal

from music_api.diagnostics_schemas import (ApplicationQueueRead, DiagnosticReason, DiagnosticSource, DiagnosticValue,
                                         DiagnosticsRead, MemoryMetricRead)
from music_api.runtime_types import RuntimeObservation


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
        "runtime_binding_unverified": ("Current Runtime source binding is unverified.", "Ask the owner to collect evidence for the actual current listener, pinned source and model layout."),
        "runtime_observation_stale": ("The overall Runtime observation is stale or has no valid source time.", "Refresh the actual Runtime source before submitting; do not renew cached source timestamps."),
        "runtime_system_facts_stale": ("The Runtime system/GPU source is stale or unavailable.", "Refresh the native system facts; a fresh aggregate timestamp does not renew this source."),
        "runtime_node_facts_stale": ("The registered capability source is stale or unavailable.", "Refresh the native node observation before submitting."),
        "capability_missing": ("The required Runtime capability is unavailable.", "Ask the owner to restore the pinned Runtime/plugin registration, then refresh."),
        "model_invalid": ("A required model failed verification.", "Inspect its recorded hash/revision in model diagnostics and preserve the invalid file for recovery."),
        "model_unverified": ("A required model has no current verified evidence.", "Inspect model diagnostics and ask the owner to verify the registered weights."),
        "model_downloading": ("A required model download is incomplete.", "Ask the owner to complete the registered download and verify its full hash."),
        "runtime_metric_unavailable": ("This source provides no valid reading for the metric.", "Retain the unavailable state; do not substitute another memory scope or a zero."),
        "runtime_metric_stale": ("The metric source is outside the freshness window.", "Refresh the underlying source; rereading cached values does not renew its timestamp."),
        "runtime_version_unavailable": ("This source provides no current version value.", "Use sourced environment facts; do not infer CUDA or driver versions from a Torch build suffix."),
        "loaded_models_unavailable": ("The pinned Runtime API does not expose loaded model identities.", "Use model verification and capabilities; a filename list does not establish loaded state."),
        "native_queue_unavailable": ("The current Runtime observation has no native occupancy reading.", "Read application Job states with their scope; do not interpret stored counts as current GPU occupancy."),
        "application_running_job_unavailable": ("No single recorded running application Job is available.", "Read the application Job states; this snapshot has no current native confirmation."),
    }
    message, recovery = messages.get(code, ("Runtime prerequisites are not currently verified.",
                                           "Ask the Runtime owner to check source binding, pinned revisions and model verification, then refresh."))
    return DiagnosticReason(code=code, message=message, recovery=recovery)


def source(source_name: str, observed_at: datetime | None, now: datetime, max_age: float) -> DiagnosticSource:
    if observed_at is not None and observed_at.tzinfo is None:
        observed_at = None
    age = None if observed_at is None else (now - observed_at).total_seconds()
    freshness: Literal["fresh", "stale", "unavailable"] = "unavailable" if age is None or age < 0 else "stale" if age > max_age else "fresh"
    return DiagnosticSource(source=source_name, observed_at=observed_at,
                            age_seconds=None if age is None or age < 0 else age,
                            freshness=freshness, max_age_seconds=max_age)


def observed_value[T](value: T | None, source_name: str, observed_at: datetime | None,
                      now: datetime, max_age: float, cause: str | None = None) -> DiagnosticValue[T]:
    metadata = source(source_name, observed_at, now, max_age)
    available = value is not None and metadata.freshness == "fresh" and cause is None
    codes = [] if available else [cause or ("runtime_metric_stale" if metadata.freshness == "stale" else "runtime_metric_unavailable")]
    return DiagnosticValue(value=value, availability="available" if available else "unavailable",
                           observation=metadata, reasons=[reason(code) for code in codes])


def number(value: object) -> int | None:
    return value if type(value) is int and value >= 0 else None


def text(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def build_diagnostics(observation: RuntimeObservation, now: datetime, max_age: float,
                      application_queue: ApplicationQueueRead) -> DiagnosticsRead:
    stats = observation.system_stats or {}
    raw_system = stats.get("system")
    system: Mapping[str, object] = raw_system if isinstance(raw_system, Mapping) else {}
    raw_devices = stats.get("devices")
    device = next((entry for entry in raw_devices if isinstance(entry, Mapping) and entry.get("type") == "cuda" and entry.get("index") == 0), {}) if isinstance(raw_devices, list) else {}
    native_source = observation.source + "/system_stats" if observation.mode == "comfyui" else observation.source
    native_time = observation.system_stats_observed_at
    native_cause = "runtime_unavailable" if not observation.reachable else None
    versions = {name: observed_value(text(system.get(key)), native_source, native_time, now, max_age, native_cause)
                for name, key in [("comfyui", "comfyui_version"), ("python", "python_version"), ("pytorch", "pytorch_version")]}
    for name in ("driver", "cuda"):
        versions[name] = observed_value(None, "Not exposed by pinned Runtime API", None, now, max_age, "runtime_version_unavailable")
    attestation = observation.attestation
    for name in ("runtime_revision", "plugin_revision"):
        raw = None if attestation is None else getattr(attestation, name)
        versions[name] = observed_value(raw, "owner receipt unavailable" if attestation is None else attestation.source,
                                       None if attestation is None else attestation.checked_at, now, max_age,
                                       None if attestation is not None and attestation.binding_verified else "runtime_binding_unavailable")
    total, proxy = number(device.get("vram_total")), number(device.get("vram_free"))
    reserved, reusable = number(device.get("torch_vram_total")), number(device.get("torch_vram_free"))
    cuda_free = proxy - reusable if proxy is not None and reusable is not None and proxy >= reusable else None
    if total is None or cuda_free is None or cuda_free > total:
        cuda_free = None
    used = total - cuda_free if total is not None and cuda_free is not None else None
    active = reserved - reusable if reserved is not None and reusable is not None and reserved >= reusable else None
    readings = [
        ("cuda_device_total_bytes", total, "CUDA device total; includes all processes"),
        ("comfy_available_proxy_bytes", proxy, "Comfy availability proxy; CUDA free plus reusable Torch reservation"),
        ("cuda_device_free_bytes", cuda_free, "CUDA device free; includes all processes"),
        ("cuda_device_used_bytes", used, "CUDA device used; includes all processes"),
        ("runtime_torch_reserved_bytes", reserved, "Runtime Torch reserved allocator"),
        ("runtime_torch_reusable_bytes", reusable, "Runtime Torch reserved minus active allocator"),
        ("runtime_torch_active_bytes", active, "Runtime Torch active allocator; includes blocks awaiting free"),
        ("runtime_reported_ram_total_bytes", number(system.get("ram_total")), "Runtime-reported system RAM; platform/cgroup scope"),
        ("runtime_reported_ram_free_bytes", number(system.get("ram_free")), "Runtime-reported system RAM; platform/cgroup scope"),
    ]
    memory = []
    for name, value, scope_name in readings:
        measured = observed_value(value, native_source, native_time, now, max_age, native_cause)
        memory.append(MemoryMetricRead(name=name, scope=scope_name, unit="bytes", **measured.model_dump()))
    for name, scope_name in [("runtime_process_gpu_resident_bytes", "Selected Runtime process GPU resident memory"),
                             ("runtime_process_rss_bytes", "Selected Runtime process host RSS/working set")]:
        measured = observed_value(None, "Not provided by the Runtime observation", None, now, max_age, "runtime_metric_unavailable")
        memory.append(MemoryMetricRead(name=name, scope=scope_name, unit="bytes", **measured.model_dump()))
    inventory = None if observation.model_inventory is None else {folder: list(names) for folder, names in observation.model_inventory.items()}
    sources = {
        "health": source(observation.source, observation.observed_at, now, max_age),
        "system_stats": source(native_source, native_time, now, max_age),
        "registered_nodes": source(observation.source + "/object_info", observation.registered_nodes_observed_at, now, max_age),
        "generic_model_inventory": source(observation.source + "/models/{folder}", observation.model_inventory_observed_at, now, max_age),
        "owner_receipt": source("owner receipt unavailable" if attestation is None else attestation.source,
                                None if attestation is None else attestation.checked_at, now, max_age),
    }
    return DiagnosticsRead(mode=observation.mode, checked_at=now, source_observations=sources,
                           gpu_name=observed_value(text(device.get("name")), native_source, native_time, now, max_age, native_cause),
                           versions=versions, memory=memory,
                           loaded_models=observed_value(None, "Pinned native API does not expose loaded model identities", None,
                                                        now, max_age, "loaded_models_unavailable"),
                           generic_model_inventory=observed_value(inventory, observation.source + "/models/{folder}",
                                                                  observation.model_inventory_observed_at, now, max_age, native_cause),
                           application_queue=application_queue,
                           native_queue_occupancy=observed_value(None, "Not included in the current Runtime observation", None,
                                                                 now, max_age, "native_queue_unavailable"))


