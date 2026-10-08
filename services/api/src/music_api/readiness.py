"""One readiness decision for diagnostics and native submission."""

from datetime import datetime
from typing import Mapping, cast

from music_api.runtime_types import CapabilityObservation, CoverMode, RuntimeObservation, RuntimeRequirements
from music_api.workflow_registry import WorkflowDefinition


def stale(when: datetime | None, now: datetime, max_age_seconds: float) -> bool:
    return when is None or when.tzinfo is None or when > now or (now - when).total_seconds() > max_age_seconds


def evaluate_readiness(observation: RuntimeObservation, requirements: RuntimeRequirements,
                       workflow: WorkflowDefinition, *, now: datetime, max_age_seconds: float) -> CapabilityObservation:
    reasons: list[str] = []
    if not observation.reachable:
        reasons.append("runtime_unavailable")
    if stale(observation.observed_at, now, max_age_seconds):
        reasons.append("runtime_observation_stale")
    if observation.registered_nodes is None or not set(workflow.required_nodes).issubset(observation.registered_nodes):
        reasons.append("capability_missing")
    required_inputs = workflow.manifest.get("required_node_inputs", {})
    if isinstance(required_inputs, Mapping):
        observed_inputs = observation.node_inputs or {}
        if any(not isinstance(fields, Mapping) or any(observed_inputs.get(str(node), {}).get(str(field)) != kind
                                                      for field, kind in fields.items())
               for node, fields in required_inputs.items()):
            reasons.append("capability_missing")
    required_enums = workflow.manifest.get("required_node_enum_values", {})
    observed_choices = observation.node_enum_choices or {}
    if isinstance(required_enums, Mapping):
        if any(not isinstance(fields, Mapping) or any(not isinstance(choices, list) or not set(choices).issubset(observed_choices.get(str(node), {}).get(str(field), ()))
                                                      for field, choices in fields.items()) for node, fields in required_enums.items()):
            reasons.append("capability_missing")
    declared_modes = workflow.manifest.get("supported_modes", [])
    modes = tuple(cast(CoverMode, mode) for mode in (declared_modes if isinstance(declared_modes, list) else [])
                  if mode in {"melody", "full"} and mode in observed_choices.get("YuE2Options", {}).get("cot", ()))
    if observation.mode == "comfyui":
        if stale(observation.system_stats_observed_at, now, max_age_seconds):
            reasons.append("runtime_system_facts_stale")
        if stale(observation.registered_nodes_observed_at, now, max_age_seconds):
            reasons.append("runtime_node_facts_stale")
        stats = observation.system_stats
        system = stats.get("system") if stats is not None else None
        if not isinstance(system, Mapping):
            reasons.append("runtime_version_unavailable")
        elif str(system.get("python_version", "")).split(" ")[0] != requirements.python_version or system.get("pytorch_version") != requirements.torch_version:
            reasons.append("runtime_version_mismatch")
        devices = stats.get("devices") if stats is not None else None
        device = next((item for item in devices if isinstance(item, Mapping) and item.get("type") == "cuda" and item.get("index") == 0), None) if isinstance(devices, list) else None
        if device is None or requirements.gpu_name not in str(device.get("name", "")):
            reasons.append("gpu_unavailable")
        else:
            capacity = device.get("vram_total")
            if type(capacity) is not int or (capacity + 524288) // 1048576 < requirements.min_vram_mib:
                reasons.append("gpu_capacity_unverified")
        attestation = observation.attestation
        if attestation is None:
            reasons.append("runtime_evidence_unavailable")
        else:
            reasons.extend(attestation.reasons)
            if attestation.mode != observation.mode or not attestation.binding_verified:
                reasons.append("runtime_binding_unverified")
            if stale(attestation.checked_at, now, max_age_seconds):
                reasons.append("runtime_evidence_stale")
            if attestation.runtime_revision != requirements.runtime_revision or attestation.plugin_revision != requirements.plugin_revision:
                reasons.append("runtime_revision_mismatch")
            models = {item.id: item for item in attestation.models}
            expected = {item.id: item for item in requirements.models}
            for identifier in workflow.required_models:
                model = models.get(identifier)
                if model is None:
                    reasons.append("model_unverified")
                elif model.state != "ready":
                    reasons.append("model_" + (model.state if model.state in {"missing", "downloading", "invalid"} else "unverified"))
                elif model.sha256 != expected[identifier].sha256 or stale(model.checked_at, now, max_age_seconds):
                    reasons.append("model_evidence_unverified")
        # Generic Comfy /models inventories do not own the pinned YuE2 model-root layout.
    return CapabilityObservation(workflow.operation, workflow.required_models, not reasons,
                                 observation.source, observation.observed_at, tuple(dict.fromkeys(reasons)), modes)
