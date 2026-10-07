"""Client diagnostics distinguish current availability from immutable source time."""

from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field


class DiagnosticReason(BaseModel):
    code: str
    message: str
    recovery: str


class DiagnosticSource(BaseModel):
    source: str
    observed_at: AwareDatetime | None
    age_seconds: float | None = Field(ge=0, allow_inf_nan=False)
    freshness: Literal["fresh", "stale", "unavailable"]
    max_age_seconds: float = Field(gt=0, allow_inf_nan=False)


class CapabilityRead(BaseModel):
    operation: Literal["Transcribe", "Generate"]
    required_models: list[str]
    ready: bool
    observation: DiagnosticSource
    reasons: list[DiagnosticReason]


class CapabilitiesRead(BaseModel):
    mode: Literal["fake", "comfyui"]
    checked_at: AwareDatetime
    capabilities: list[CapabilityRead]


class ModelRead(BaseModel):
    id: str
    name: str
    provider: str
    repository: str
    revision: str
    filename: str
    local_path: str
    registry_source: str
    hash_source: str
    components: list[str]
    component_license_notes: str | None
    expected_sha256: str
    expected_size_bytes: int = Field(gt=0)
    weights_license: str
    license_source: str
    state: Literal["missing", "downloading", "ready", "invalid", "unavailable"]
    observed_sha256: str | None
    observation: DiagnosticSource
    reasons: list[DiagnosticReason]


class CodeRegistryRead(BaseModel):
    component: Literal["runtime", "plugin"]
    expected_revision: str
    code_license: str | None
    license_source: str | None
    registry_source: str


class ModelsRead(BaseModel):
    mode: Literal["fake", "comfyui"]
    checked_at: AwareDatetime
    code_registry: list[CodeRegistryRead]
    models: list[ModelRead]
