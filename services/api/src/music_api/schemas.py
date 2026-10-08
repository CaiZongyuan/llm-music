"""Pydantic is the public application contract source."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from music_api.runtime_types import Operation


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    description: str = Field(default="", max_length=2000)


class ProjectRead(ProjectCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    kind: Literal["reference_audio", "score_abc", "score_midi", "generated_audio"]
    original_name: str
    format: Literal["wav", "abc", "mid", "flac"]
    media_type: str
    size_bytes: int = Field(gt=0)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    duration_seconds: float | None = Field(default=None, gt=0)
    channels: int | None = Field(default=None, ge=1, le=2)
    sample_rate: int | None = Field(default=None, gt=0)
    sample_width_bits: Literal[8, 16, 24, 32] | None = None
    created_at: datetime


class ErrorDetail(BaseModel):
    code: str
    message: str
    recovery: str
    resource_id: UUID | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class TranscribeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reference_asset_id: UUID


class JobRead(BaseModel):
    id: UUID
    project_id: UUID
    operation: Operation
    status: Literal["queued", "running", "completed", "failed", "cancelled"]
    phase: str | None
    progress: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    inputs: dict[str, object]
    provenance: dict[str, object]
    error: dict[str, object] | None
    result: dict[str, str] | None
    recovery_required: bool
    cancel_requested: bool = False
    created_at: datetime
    updated_at: datetime


class ScoreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    job_id: UUID | None
    abc_asset_id: UUID
    source_reference_asset_id: UUID | None
    source_score_id: UUID | None
    parent_version_id: UUID | None
    created_at: datetime


class ScoreValidate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    abc: str = Field(min_length=1, max_length=100000)


class ScoreCreate(ScoreValidate):
    save_id: UUID = Field(default_factory=uuid4, description="Stable save-intent id. Repeating identical input returns the same immutable Score.")
    source_score_id: UUID | None = Field(default=None, description="Optional source Score in this Project; its files remain immutable.")
    parent_version_id: UUID | None = Field(default=None, description="Optional Version owning the source Score, or its retained editing parent.")


class ScoreValidationRead(BaseModel):
    note_count: int = Field(gt=0)
    abc_sha256: str
    effective_abc_sha256: str
    transformations: list[str]
    adapter_version: str
    parser: str
