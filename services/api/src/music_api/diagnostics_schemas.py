"""Client diagnostics distinguish current availability from immutable source time."""

from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, JsonValue

from music_api.runtime_types import Operation


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
    operation: Operation
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


class BackendHealthRead(BaseModel):
    status: Literal["ready"]
    scope: Literal["application HTTP process"]
    version: str
    python_version: str
    observation: DiagnosticSource


class RuntimeHealthRead(BaseModel):
    mode: Literal["fake", "comfyui"]
    status: Literal["ready", "not_ready", "unavailable"]
    reachable: bool
    ready: bool
    binding_verified: bool | None
    observation: DiagnosticSource
    reasons: list[DiagnosticReason]


class HealthRead(BaseModel):
    checked_at: AwareDatetime
    backend: BackendHealthRead
    runtime: RuntimeHealthRead


class DiagnosticValue[T](BaseModel):
    value: T | None
    availability: Literal["available", "unavailable"]
    observation: DiagnosticSource
    reasons: list[DiagnosticReason]


class MemoryMetricRead(DiagnosticValue[int]):
    name: str
    scope: str
    unit: Literal["bytes"]
    value: int | None = Field(ge=0)


class ActiveApplicationJobRead(BaseModel):
    id: UUID
    project_id: UUID
    operation: Operation
    status: Literal["queued", "running"]
    phase: str | None
    observation: DiagnosticSource


class ApplicationQueueRead(BaseModel):
    scope: Literal["Application persisted active Job states; not native occupancy"]
    queued: int = Field(ge=0)
    running: int = Field(ge=0)
    jobs: list[ActiveApplicationJobRead]
    recorded_running_job: DiagnosticValue[str]
    observation: DiagnosticSource


class DiagnosticsRead(BaseModel):
    mode: Literal["fake", "comfyui"]
    checked_at: AwareDatetime
    source_observations: dict[str, DiagnosticSource]
    gpu_name: DiagnosticValue[str]
    versions: dict[str, DiagnosticValue[str]]
    memory: list[MemoryMetricRead]
    loaded_models: DiagnosticValue[list[str]]
    generic_model_inventory: DiagnosticValue[dict[str, list[str]]]
    application_queue: ApplicationQueueRead
    native_queue_occupancy: DiagnosticValue[int]


class SettingsMetadataRead(BaseModel):
    source: Literal["music_api.config.Settings.model_json_schema"]
    environment_prefix: str
    environment_variables: dict[str, str]
    settings_schema: dict[str, JsonValue]
