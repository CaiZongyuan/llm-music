"""Upgrade a real supported 0001 database and preserve its public original data."""

from contextlib import closing
import hashlib
from pathlib import Path
import sqlite3

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.main import create_app
from test_transcription import reference_audio


def test_supported_0001_reference_audio_upgrades_with_same_ids_metadata_and_bytes(tmp_path: Path) -> None:
    data = reference_audio()
    project_id = "11111111-1111-4111-8111-111111111111"
    asset_id = "22222222-2222-4222-8222-222222222222"
    created_at = "2026-10-07T00:00:00+00:00"
    database_path = tmp_path / "app.sqlite"
    engine = create_engine("sqlite:///" + database_path.as_posix())
    configured = Config()
    configured.set_main_option("script_location", str(Path(__file__).parents[1] / "src/music_api/migrations"))
    with engine.begin() as connection:
        configured.attributes["connection"] = connection
        command.upgrade(configured, "0001_project_audio")
    engine.dispose()
    key = project_id + "/" + asset_id + ".wav"
    source = tmp_path / "assets" / key
    source.parent.mkdir(parents=True)
    source.write_bytes(data)
    digest = hashlib.sha256(data).hexdigest()
    with closing(sqlite3.connect(database_path)) as database, database:
        database.execute("INSERT INTO projects VALUES (?,?,?,?)", (project_id, "Morning song", "Original supported schema", created_at))
        database.execute("INSERT INTO assets VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (asset_id, project_id, "reference_audio", "reference.wav", key,
                         "wav", "audio/wav", 768044, digest, 16.0, 1, 24000, 16, created_at))
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.get("/projects/" + project_id).json()
        assert project["id"] == project_id and project["name"] == "Morning song"
        base = "/projects/" + project_id + "/assets"
        asset = client.get(base + "/" + asset_id).json()
        assert asset["id"] == asset_id and asset["project_id"] == project_id
        assert asset["sha256"] == digest and asset["size_bytes"] == 768044
        assert asset["duration_seconds"] == 16 and asset["sample_rate"] == 24000 and asset["sample_width_bits"] == 16
        assert client.get(base).json() == [asset]
        assert client.get(base + "/" + asset_id + "/content").content == data
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        assert client.get(base + "/" + asset_id).json() == asset
        assert client.get(base + "/" + asset_id + "/content").content == data
