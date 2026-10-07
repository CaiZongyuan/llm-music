"""Read-only owner receipts and CPU binding checks; no native HTTP or CUDA probe."""

from pathlib import Path
from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError

from music_api.runtime_types import ModelEvidence, RuntimeAttestation, RuntimeRequirements


class ModelFingerprint(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    resolved_path: Path
    size_bytes: int = Field(ge=0)
    mtime_ns: int = Field(ge=0)


class ModelReceipt(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    id: str = Field(min_length=1)
    state: Literal["missing", "downloading", "ready", "invalid"]
    revision: str = Field(pattern=r"^[0-9a-f]{40}$")
    checked_at: AwareDatetime
    actual_sha256: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    actual_size_bytes: int | None = Field(default=None, ge=0)
    fingerprint: ModelFingerprint | None = None


class ProcessReceipt(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    pid: int = Field(gt=0)
    create_time: float = Field(gt=0, allow_inf_nan=False)
    executable: Path
    entrypoint: Path


class RuntimeReceipt(BaseModel):
    """Owner source timestamps remain immutable when the JSON is read or saved."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    schema_version: Literal[1]
    mode: Literal["comfyui"]
    runtime_url: str = Field(min_length=1)
    source: str = Field(min_length=1, max_length=500)
    checked_at: AwareDatetime
    runtime_root: Path
    models_root: Path
    runtime_revision: str = Field(pattern=r"^[0-9a-f]{40}$")
    plugin_revision: str = Field(pattern=r"^[0-9a-f]{40}$")
    process: ProcessReceipt
    models: list[ModelReceipt]


def read_runtime_evidence(path: Path | None, *, runtime_url: str, now: datetime,
                          max_age_seconds: float, requirements: RuntimeRequirements) -> RuntimeAttestation:
    if path is None:
        return RuntimeAttestation("comfyui", runtime_url, "owner receipt unavailable", None, False, None, None,
                                  reasons=("runtime_evidence_unavailable",))
    try:
        if path.stat().st_size > 131072:
            raise ValueError("Receipt exceeds the bounded source document size")
        receipt = RuntimeReceipt.model_validate_json(path.read_bytes())
    except (OSError, ValueError, ValidationError):
        return RuntimeAttestation("comfyui", runtime_url, "owner receipt unavailable", None, False, None, None,
                                  reasons=("runtime_evidence_invalid",))

    age = (now - receipt.checked_at).total_seconds()
    reasons = []
    if age < 0:
        reasons.append("runtime_evidence_future")
    elif age > max_age_seconds:
        reasons.append("runtime_evidence_stale")
    if receipt.runtime_url.rstrip("/") != runtime_url.rstrip("/"):
        reasons.append("runtime_evidence_identity_mismatch")
    if receipt.runtime_revision != requirements.runtime_revision or receipt.plugin_revision != requirements.plugin_revision:
        reasons.append("runtime_evidence_revision_mismatch")
    if not reasons:
        reasons.append("runtime_binding_unverified")

    models = tuple(ModelEvidence(item.id, "unknown", receipt.source, item.checked_at, item.actual_sha256,
                                 tuple(reasons)) for item in receipt.models)
    return RuntimeAttestation("comfyui", runtime_url, receipt.source, receipt.checked_at, False,
                              receipt.runtime_revision, receipt.plugin_revision, models, tuple(reasons))
