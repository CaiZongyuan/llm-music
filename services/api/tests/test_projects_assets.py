"""Exercise public HTTP with real isolated SQLite and application storage."""

from pathlib import Path
import hashlib
import io
import wave
import sqlite3
from uuid import uuid4

import pytest

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.main import create_app


def reference_wav() -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setparams((1, 2, 8000, 0, "NONE", "not compressed"))
        writer.writeframes(b"\x10\x00" * 16000)
    return output.getvalue()


def test_create_list_and_read_project(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        assert client.get("/projects").json() == []
        response = client.post("/projects", json={"name": " Morning song ", "description": "First reference"})
        assert response.status_code == 201
        project = response.json()
        assert project["name"] == "Morning song"
        assert project["description"] == "First reference"
        assert client.get("/projects/" + project["id"]).json() == project
        assert client.get("/projects").json() == [project]


def test_upload_read_and_download_real_audio(tmp_path: Path) -> None:
    data = reference_wav()
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"] + "/assets"
        assert client.get(base).json() == []
        response = client.post(base, files={"file": ("../../source.audio", data, "application/octet-stream")})
        assert response.status_code == 201
        asset = response.json()
        assert asset["kind"] == "reference_audio"
        assert asset["format"] == "wav"
        assert asset["original_name"] == "source.audio"
        assert asset["size_bytes"] == 32044
        assert asset["sha256"] == hashlib.sha256(data).hexdigest()
        assert asset["duration_seconds"] == 2
        assert asset["sample_rate"] == 8000
        assert asset["channels"] == 1
        assert client.get(base).json() == [asset]
        assert client.get(base + "/" + asset["id"]).json() == asset
        downloaded = client.get(base + "/" + asset["id"] + "/content")
        assert downloaded.status_code == 200
        assert downloaded.content == data
        assert downloaded.headers["content-type"] == "audio/wav"


def test_lost_commit_acknowledgement_preserves_registered_audio(tmp_path: Path) -> None:
    armed = {"value": False}

    def lose_acknowledgement(session: Session) -> None:
        if armed["value"]:
            armed["value"] = False
            raise RuntimeError("Injected lost acknowledgement after durable commit")

    event.listen(Session, "after_commit", lose_acknowledgement)
    try:
        with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"] + "/assets"
            armed["value"] = True
            response = client.post(base, files={"file": ("reference.wav", reference_wav())})
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "asset_commit_unconfirmed"
            identifier = response.json()["error"]["resource_id"]
            assert client.get(base).json()[0]["id"] == identifier
            assert client.get(base + "/" + identifier).status_code == 200
            assert client.get(base + "/" + identifier + "/content").content == reference_wav()
        with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
            assert client.get(base + "/" + identifier + "/content").content == reference_wav()
    finally:
        event.remove(Session, "after_commit", lose_acknowledgement)


def test_metadata_insert_failure_compensates_only_this_upload(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"] + "/assets"
        prior = client.post(base, files={"file": ("prior.wav", reference_wav())}).json()
        before = {path.relative_to(tmp_path): path.read_bytes() for path in (tmp_path / "assets").rglob("*.wav")}
        with sqlite3.connect(tmp_path / "app.sqlite") as database:
            database.execute("CREATE TRIGGER fail_asset BEFORE INSERT ON assets BEGIN SELECT RAISE(ABORT, 'injected commit failure'); END")
        response = client.post(base, files={"file": ("new.wav", reference_wav())})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "asset_persistence_failed"
        assert client.get(base).json() == [prior]
        assert client.get(base + "/" + prior["id"] + "/content").content == reference_wav()
        assert {path.relative_to(tmp_path): path.read_bytes() for path in (tmp_path / "assets").rglob("*.wav")} == before
        assert not list((tmp_path / "assets").rglob("*.part"))


def test_storage_write_failure_has_explicit_error_and_no_registered_asset(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"] + "/assets"
        obstruction = tmp_path / "assets" / ".staging"
        obstruction.write_bytes(b"owned test obstruction")
        response = client.post(base, files={"file": ("reference.wav", reference_wav())})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "asset_write_failed"
        assert client.get(base).json() == []
        assert obstruction.read_bytes() == b"owned test obstruction"


def test_chunked_multipart_body_is_bounded_before_registration(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, max_upload_bytes=32768))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"] + "/assets"
        body = (b'--upload\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\n'
                b'Content-Type: audio/wav\r\n\r\n' + reference_wav() + b'\r\n--upload\r\n'
                b'Content-Disposition: form-data; name="unused"\r\n\r\n' + b"x" * 100000 + b"\r\n--upload--\r\n")
        response = client.post(base, content=iter([body[:50000], body[50000:]]),
                               headers={"content-type": "multipart/form-data; boundary=upload"})
        assert response.status_code == 413
        assert response.json()["error"]["code"] == "upload_too_large"
        assert client.get(base).json() == []


def test_invalid_request_has_the_same_public_error_contract(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        response = client.post("/projects", json={"name": "  "})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_request"
        assert "name" in response.json()["error"]["message"]


@pytest.mark.parametrize("data", [b"not audio", reference_wav()[:-1]], ids=["invalid_magic", "truncated_pcm"])
def test_invalid_or_truncated_content_does_not_register_an_asset(tmp_path: Path, data: bytes) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"] + "/assets"
        response = client.post(base, files={"file": ("reference.wav", data, "audio/wav")})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_audio"
        assert client.get(base).json() == []
        assert not list((tmp_path / "assets").rglob("*.part"))
        assert not list((tmp_path / "assets").rglob("*.wav"))


@pytest.mark.parametrize("changes,code", [({"max_upload_bytes": 32043}, "upload_too_large"),
                                         ({"max_audio_seconds": 1}, "audio_duration_exceeded")])
def test_configured_upload_budgets_are_enforced(tmp_path: Path, changes: dict[str, int], code: str) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, **changes))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"] + "/assets"
        response = client.post(base, files={"file": ("reference.wav", reference_wav())})
        assert response.status_code == 413
        assert response.json()["error"]["code"] == code
        assert client.get(base).json() == []
        assert not list((tmp_path / "assets").rglob("*.part"))
        assert not list((tmp_path / "assets").rglob("*.wav"))


def test_cross_project_asset_reference_and_missing_project_are_rejected(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        first = client.post("/projects", json={"name": "Morning song"}).json()
        second = client.post("/projects", json={"name": "Another song"}).json()
        asset = client.post("/projects/" + first["id"] + "/assets", files={"file": ("reference.wav", reference_wav())}).json()
        foreign = "/projects/" + second["id"] + "/assets/" + asset["id"]
        for url in [foreign, foreign + "/content"]:
            response = client.get(url)
            assert response.status_code == 404
            assert response.json()["error"]["code"] == "asset_not_found"
        response = client.post("/projects/" + str(uuid4()) + "/assets", files={"file": ("reference.wav", reference_wav())})
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "project_not_found"
        assert client.get("/projects/" + second["id"] + "/assets").json() == []


def test_missing_file_is_an_explicit_recovery_error(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"] + "/assets"
        asset = client.post(base, files={"file": ("reference.wav", reference_wav())}).json()
        next((tmp_path / "assets").rglob("*.wav")).unlink()
        for url in [base, base + "/" + asset["id"], base + "/" + asset["id"] + "/content"]:
            response = client.get(url)
            assert response.status_code == 409
            assert response.json()["error"]["code"] == "asset_unavailable"


@pytest.mark.parametrize("key", ["../outside.wav", "C:/outside/audio.wav", str(uuid4()) + "/" + str(uuid4()) + ".wav"])
def test_corrupt_storage_reference_is_rejected_without_reading_another_path(tmp_path: Path, key: str) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"] + "/assets"
        asset = client.post(base, files={"file": ("reference.wav", reference_wav())}).json()
        with sqlite3.connect(tmp_path / "app.sqlite") as database:
            database.execute("UPDATE assets SET storage_key=? WHERE id=?", (key, asset["id"]))
        response = client.get(base + "/" + asset["id"] + "/content")
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "asset_path_invalid"


def test_initial_migration_is_wal_and_restart_preserves_existing_rows(tmp_path: Path) -> None:
    configured = Settings(data_dir=tmp_path)
    with TestClient(create_app(configured)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
    with sqlite3.connect(tmp_path / "app.sqlite") as database:
        assert database.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert database.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "0001_project_audio"
    with TestClient(create_app(configured)) as client:
        assert client.get("/projects/" + project["id"]).json() == project


def test_openapi_describes_only_the_implemented_domain_contract(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        schema = client.get("/openapi.json").json()
        assert "/projects/{project_id}/assets/{asset_id}/content" in schema["paths"]
        assert schema["components"]["schemas"]["AssetRead"]["properties"]["id"]["format"] == "uuid"
        assert "storage_key" not in schema["components"]["schemas"]["AssetRead"]["properties"]
        assert "ErrorResponse" in schema["components"]["schemas"]
        assert not any("jobs" in path or "versions" in path for path in schema["paths"])


def test_unknown_commit_readback_retains_the_blob_until_recovery(tmp_path: Path) -> None:
    armed = {"commit": False, "readback": False}

    def lose_acknowledgement(session: Session) -> None:
        if armed["commit"]:
            armed["commit"] = False
            armed["readback"] = True
            raise RuntimeError("Injected lost durable commit acknowledgement")

    def fail_readback(connection: object, cursor: object, statement: str, parameters: object,
                      context: object, executemany: bool) -> None:
        if armed["readback"] and statement.startswith("SELECT assets.id"):
            armed["readback"] = False
            raise sqlite3.OperationalError("Injected metadata readback unavailable")

    event.listen(Session, "after_commit", lose_acknowledgement)
    event.listen(Engine, "before_cursor_execute", fail_readback)
    try:
        with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"] + "/assets"
            armed["commit"] = True
            response = client.post(base, files={"file": ("reference.wav", reference_wav())})
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "asset_commit_unconfirmed"
            identifier = response.json()["error"]["resource_id"]
            assert client.get(base + "/" + identifier + "/content").content == reference_wav()
    finally:
        event.remove(Session, "after_commit", lose_acknowledgement)
        event.remove(Engine, "before_cursor_execute", fail_readback)


def test_cleanup_failure_retains_isolated_stage_and_still_compensates_uncommitted_final(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    real_unlink = Path.unlink

    def block_staged_cleanup(path: Path, missing_ok: bool = False) -> None:
        if path.suffix == ".part":
            raise PermissionError("Injected temporary-file cleanup failure")
        real_unlink(path, missing_ok=missing_ok)

    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"] + "/assets"
        with sqlite3.connect(tmp_path / "app.sqlite") as database:
            database.execute("CREATE TRIGGER fail_asset BEFORE INSERT ON assets BEGIN SELECT RAISE(ABORT, 'injected'); END")
        monkeypatch.setattr(Path, "unlink", block_staged_cleanup)
        response = client.post(base, files={"file": ("reference.wav", reference_wav())})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "storage_cleanup_failed"
        assert response.json()["error"]["resource_id"]
        assert client.get(base).json() == []
        assert not list((tmp_path / "assets").rglob("*.wav"))
        assert len(list((tmp_path / "assets").rglob("*.part"))) == 1


def test_interrupted_initial_schema_creation_can_restart_without_partial_tables(tmp_path: Path) -> None:
    def fail_ddl(connection: object, cursor: object, statement: str, parameters: object,
                 context: object, executemany: bool) -> None:
        if "CREATE TABLE assets" in statement:
            raise sqlite3.OperationalError("Injected initial migration failure")

    event.listen(Engine, "before_cursor_execute", fail_ddl)
    try:
        with pytest.raises(sqlite3.OperationalError):
            with TestClient(create_app(Settings(data_dir=tmp_path))):
                pass
    finally:
        event.remove(Engine, "before_cursor_execute", fail_ddl)
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        assert client.get("/projects").json() == []
        response = client.post("/projects", json={"name": "Recovered morning song"})
        assert response.status_code == 201
