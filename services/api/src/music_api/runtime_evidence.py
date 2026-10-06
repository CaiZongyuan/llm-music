"""Read-only owner receipts and CPU binding checks; no native HTTP or CUDA probe."""

from pathlib import Path
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


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
