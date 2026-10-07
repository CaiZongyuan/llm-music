"""Generation and explicit saved-version contracts contain application ids only."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class GenerateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    style: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1024)]
    lyrics: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10000)]
    seed: int = Field(ge=0, le=(1 << 63) - 1, strict=True)
    max_seconds: Literal[35] = 35


class CandidateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    job_id: UUID
    audio_asset_id: UUID
    score_id: UUID
    inputs: GenerateCreate
    provenance: dict[str, object]
    output_snapshot: dict[str, object]
    created_at: datetime


class VersionSave(BaseModel):
    model_config = ConfigDict(extra="forbid")
    candidate_id: UUID
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    parent_version_id: UUID | None = None


class VersionRead(CandidateRead):
    candidate_id: UUID
    name: str
    parent_version_id: UUID | None
