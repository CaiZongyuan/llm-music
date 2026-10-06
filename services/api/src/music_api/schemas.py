"""Pydantic is the public application contract source."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


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
    kind: Literal["reference_audio"]
    original_name: str
    format: Literal["wav"]
    media_type: Literal["audio/wav"]
    size_bytes: int = Field(gt=0)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    duration_seconds: float = Field(gt=0)
    channels: int = Field(ge=1, le=2)
    sample_rate: int = Field(gt=0)
    sample_width_bits: Literal[8, 16, 24, 32]
    created_at: datetime


class ErrorDetail(BaseModel):
    code: str
    message: str
    recovery: str
    resource_id: UUID | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
