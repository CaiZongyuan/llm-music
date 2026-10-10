"""Application settings; this project never reads Runtime configuration."""

from pathlib import Path
from ipaddress import ip_address
from urllib.parse import urlsplit
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MUSIC_API_")

    data_dir: Path = Path(__file__).resolve().parents[4] / "data"
    local_host: str = Field(default="127.0.0.1", description="Exact loopback listener address; set by the serving entrypoint.")
    local_port: int = Field(default=8000, ge=1, le=65535)
    lan_host: str | None = Field(default=None, description="Opt-in selected local IPv4; never a wildcard or automatically chosen interface.")
    lan_port: int = Field(default=8001, ge=1, le=65535)
    owner_origins: list[str] = Field(default=["http://127.0.0.1:5173", "http://localhost:5173"], description="Exact browser Origins allowed for local pairing administration.")

    @field_validator("local_host")
    @classmethod
    def loopback_host(cls, value: str) -> str:
        if value not in {"127.0.0.1", "::1"}:
            raise ValueError("local_host must be an explicit loopback address")
        return value

    @field_validator("lan_host")
    @classmethod
    def unicast_ipv4(cls, value: str | None) -> str | None:
        if value is not None:
            address = ip_address(value)
            if address.version != 4 or address.is_loopback or address.is_unspecified or address.is_multicast or address.is_reserved:
                raise ValueError("lan_host must be a non-loopback unicast IPv4")
            return str(address)
        return None

    @field_validator("owner_origins")
    @classmethod
    def local_browser_origins(cls, values: list[str]) -> list[str]:
        for value in values:
            url = urlsplit(value)
            if url.scheme not in {"http", "https"} or url.hostname not in {"127.0.0.1", "localhost", "::1"} \
                    or url.username is not None or url.password is not None or url.path or url.query or url.fragment:
                raise ValueError("owner_origins must contain exact local browser Origins")
            if url.port is not None and not 1 <= url.port <= 65535:
                raise ValueError("owner Origin port must be between 1 and 65535")
        return values
    max_upload_bytes: int = Field(default=64 * 1024 * 1024, gt=0)
    max_audio_seconds: float = Field(default=600, gt=0, allow_inf_nan=False)
    runtime_mode: Literal["fake", "comfyui"] = Field(default="fake", description="Identifiable Runtime mode; each mode owns an isolated data namespace.")
    runtime_url: str = Field(default="http://127.0.0.1:8188", description="Loopback ComfyUI URL, used only in explicit comfyui mode.")
    runtime_timeout_seconds: float = Field(default=10, gt=0, allow_inf_nan=False, description="Bounded native HTTP timeout.")
    runtime_evidence_path: Path | None = Field(default=None, description="Read-only owner receipt; reading it does not renew its source timestamps.")
    diagnostics_max_age_seconds: float = Field(default=300, gt=0, allow_inf_nan=False, description="Freshness window for live Runtime observations. Immutable owner/model proof remains valid while the actual process, pinned source and model fingerprints match.")
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
