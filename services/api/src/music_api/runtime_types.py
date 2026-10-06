"""Typed facts shared by the two operations and Runtime diagnostics."""

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Literal, Mapping, Protocol
from uuid import UUID


Operation = Literal["Transcribe", "Generate"]
RuntimeMode = Literal["fake", "comfyui"]
ArtifactRole = Literal["abc", "midi", "audio"]
ArtifactFormat = Literal["abc", "mid", "wav", "flac"]


@dataclass(frozen=True)
class ModelRequirement:
    id: str
    name: str
    provider: str
    repository: str
    revision: str
    filename: str
    local_path: str
    sha256: str
    size_bytes: int
    weights_license: str
    license_source: str
    hash_source: str
    components: tuple[str, ...] = ()
    component_license_notes: str | None = None


@dataclass(frozen=True)
class RuntimeRequirements:
    runtime_revision: str
    plugin_revision: str
    python_version: str
    torch_version: str
    gpu_name: str
    models: tuple[ModelRequirement, ...]
    min_vram_mib: int = 8192
    runtime_code_license: str | None = None
    runtime_license_source: str | None = None
    plugin_code_license: str | None = None
    plugin_license_source: str | None = None
    source: str = "Pinned repository Runtime and model registry"


@dataclass(frozen=True)
class ModelEvidence:
    id: str
    state: Literal["missing", "downloading", "ready", "invalid", "unknown"]
    source: str
    checked_at: datetime | None
    sha256: str | None = None
    reasons: tuple[str, ...] = ()


@dataclass(frozen=True)
class RuntimeAttestation:
    mode: RuntimeMode
    runtime_url: str
    source: str
    checked_at: datetime | None
    binding_verified: bool
    runtime_revision: str | None
    plugin_revision: str | None
    models: tuple[ModelEvidence, ...] = ()
    reasons: tuple[str, ...] = ()


@dataclass(frozen=True)
class RuntimeObservation:
    mode: RuntimeMode
    source: str
    observed_at: datetime | None
    reachable: bool
    system_stats: Mapping[str, object] | None = None
    registered_nodes: frozenset[str] | None = None
    model_inventory: Mapping[str, tuple[str, ...]] | None = None
    system_stats_observed_at: datetime | None = None
    registered_nodes_observed_at: datetime | None = None
    model_inventory_observed_at: datetime | None = None
    attestation: RuntimeAttestation | None = None
    reasons: tuple[str, ...] = ()


@dataclass(frozen=True)
class CapabilityObservation:
    operation: Operation
    required_models: tuple[str, ...]
    ready: bool
    source: str
    observed_at: datetime | None
    reasons: tuple[str, ...] = ()


@dataclass(frozen=True)
class RuntimeRequest:
    attempt_id: UUID
    operation: Operation
    inputs: Mapping[str, object]
    reference_path: Path | None = None


@dataclass(frozen=True)
class SubmissionReceipt:
    outcome: Literal["accepted", "rejected", "unconfirmed"]
    handle: str | None = None
    code: str | None = None
    message: str | None = None


@dataclass(frozen=True)
class RuntimeStatus:
    state: Literal["queued", "running", "completed", "failed", "cancelled", "unconfirmed"]
    phase: str | None = None
    progress: float | None = None
    code: str | None = None
    message: str | None = None


@dataclass(frozen=True)
class RuntimeArtifact:
    role: ArtifactRole
    data: bytes
    format: ArtifactFormat
    media_type: str
    name: str


@dataclass(frozen=True)
class RuntimeResult:
    artifacts: tuple[RuntimeArtifact, ...]
    provenance: Mapping[str, object] = field(default_factory=dict)
    score_validation: Mapping[str, object] | None = None


class InferenceRuntime(Protocol):
    mode: RuntimeMode

    def health(self) -> RuntimeObservation: ...
    def capabilities(self, observation: RuntimeObservation | None = None) -> tuple[CapabilityObservation, ...]: ...
    def submit(self, request: RuntimeRequest) -> SubmissionReceipt: ...
    def status(self, handle: str) -> RuntimeStatus: ...
    def recover(self, request: RuntimeRequest) -> SubmissionReceipt: ...
    def result(self, handle: str, operation: Operation) -> RuntimeResult: ...
