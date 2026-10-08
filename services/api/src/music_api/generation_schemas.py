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


class GenerateFromScoreCreate(GenerateCreate):
    abc: str = Field(min_length=1, max_length=100000, description="Explicitly selected ABC; copied exactly into the Job input snapshot.")
    source_score_id: UUID = Field(description="Existing source Score in this Project; edited ABC may differ from its original Asset.")
    parent_version_id: UUID | None = Field(default=None, description="Optional same-Project Version owning the source Score or retained as its explicit editing parent; retained on Version save.")


class CoverCreate(GenerateFromScoreCreate):
    mode: Literal["melody", "full"] = Field(description="Explicit Cover mode: melody omits written chord symbols; full retains them. Both keep the two musical voices.")
    reference_asset_id: UUID
    effective_abc_sha256: str = Field(pattern=r"^[0-9a-f]{64}$", description="Hash of the effective ABC the creator inspected and selected.")
    mode_transform_version: Literal["1.0.0"]


class CandidateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    job_id: UUID
    audio_asset_id: UUID
    score_id: UUID
    inputs: CoverCreate | GenerateFromScoreCreate | GenerateCreate
    provenance: dict[str, object]
    output_snapshot: dict[str, object]
    created_at: datetime


class VersionSave(BaseModel):
    model_config = ConfigDict(extra="forbid")
    candidate_id: UUID
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    parent_version_id: UUID | None = Field(default=None, description="Generate may choose a same-Project parent. GenerateFromScore retains its submitted parent when omitted and rejects a different parent.")


class VersionRead(CandidateRead):
    candidate_id: UUID
    name: str
    parent_version_id: UUID | None
