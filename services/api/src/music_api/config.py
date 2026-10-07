"""Application settings; this project never reads Runtime configuration."""

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MUSIC_API_")

    data_dir: Path = Path(__file__).resolve().parents[4] / "data"
    max_upload_bytes: int = Field(default=64 * 1024 * 1024, gt=0)
    max_audio_seconds: float = Field(default=600, gt=0, allow_inf_nan=False)
    runtime_mode: Literal["fake", "comfyui"] = Field(default="fake", description="Identifiable Runtime mode; each mode owns an isolated data namespace.")
    runtime_url: str = Field(default="http://127.0.0.1:8188", description="Loopback ComfyUI URL, used only in explicit comfyui mode.")
    runtime_timeout_seconds: float = Field(default=10, gt=0, allow_inf_nan=False, description="Bounded native HTTP timeout.")
    runtime_evidence_path: Path | None = Field(default=None, description="Read-only owner receipt; reading it does not renew its source timestamps.")
    diagnostics_max_age_seconds: float = Field(default=300, gt=0, allow_inf_nan=False, description="Freshness policy for observed readiness and immutable owner evidence.")
    recovery_confirmation_window_seconds: float = Field(default=300, gt=0, allow_inf_nan=False, description="Durable confirmation budget for uncertain original Runtime work; API restarts do not renew it.")
    recovery_max_attempts: int = Field(default=30, gt=0, description="Persisted attempt limit when original Runtime work is unconfirmed.")
    recovery_poll_interval_seconds: float = Field(default=1, gt=0, allow_inf_nan=False, description="Initial bounded recovery polling interval.")
    recovery_max_poll_interval_seconds: float = Field(default=10, gt=0, allow_inf_nan=False, description="Maximum recovery polling interval.")

    @property
    def database_path(self) -> Path:
        return self.data_dir.resolve() / "app.sqlite"

    @property
    def assets_root(self) -> Path:
        return self.data_dir.resolve() / "assets"
