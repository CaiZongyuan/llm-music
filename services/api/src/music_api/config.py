"""Application settings; this project never reads Runtime configuration."""

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MUSIC_API_")

    data_dir: Path = Path(__file__).resolve().parents[4] / "data"
    max_upload_bytes: int = Field(default=64 * 1024 * 1024, gt=0)
    max_audio_seconds: float = Field(default=600, gt=0, allow_inf_nan=False)

    @property
    def database_path(self) -> Path:
        return self.data_dir.resolve() / "app.sqlite"

    @property
    def assets_root(self) -> Path:
        return self.data_dir.resolve() / "assets"
