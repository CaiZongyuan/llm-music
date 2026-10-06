"""Real CPU HTTP processes verify committed data survives an actual stop/restart."""

from contextlib import closing, contextmanager
import importlib.util
import json
from pathlib import Path
import socket
import subprocess
import sys
import time
import sqlite3
from collections.abc import Iterator

import httpx

from test_projects_assets import reference_wav


@contextmanager
def server(data_dir: Path, log_path: Path) -> Iterator[httpx.Client]:
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    with log_path.open("wb") as log:
        process = subprocess.Popen([sys.executable, str(Path(__file__).with_name("run_server.py")), str(data_dir), str(port)],
                                   stdin=subprocess.PIPE, stdout=log, stderr=log,
                                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        try:
            with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=2) as client:
                deadline = time.monotonic() + 15
                while True:
                    if process.poll() is not None:
                        raise AssertionError(log_path.read_text(encoding="utf-8", errors="replace"))
                    try:
                        response = client.get("/openapi.json")
                        if response.status_code == 200 and response.json()["info"]["title"] == "Music Application API":
                            break
                    except httpx.TransportError:
                        pass
                    if time.monotonic() >= deadline:
                        raise AssertionError("Owned isolated API did not become ready")
                    time.sleep(min(0.05, max(0, deadline - time.monotonic())))
                yield client
        finally:
            if process.poll() is None:
                assert process.stdin is not None
                process.stdin.write(b"\n")
                process.stdin.flush()
                process.stdin.close()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.terminate()
                    process.wait(timeout=10)
                    raise AssertionError("Owned API did not acknowledge graceful shutdown")
            assert "Application shutdown complete." in log_path.read_text(encoding="utf-8", errors="replace")


def test_actual_process_restart_and_runtime_scratch_cleanup_preserve_audio(tmp_path: Path) -> None:
    assert importlib.util.find_spec("torch") is None
    data_dir = tmp_path / "application"
    runtime_temp = tmp_path / "isolated-runtime-temp"
    runtime_temp.mkdir()
    original = runtime_temp / "reference.wav"
    original.write_bytes(reference_wav())
    with server(data_dir, tmp_path / "first-server.log") as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"] + "/assets"
        response = client.post(base, files={"file": (original.name, original.read_bytes())})
        assert response.status_code == 201
        asset = response.json()
        assert client.get(base + "/" + asset["id"] + "/content").content == reference_wav()
    original.unlink()
    runtime_temp.rmdir()
    with server(data_dir, tmp_path / "second-server.log") as client:
        assert client.get("/projects/" + project["id"]).json() == project
        assert client.get(base).json() == [asset]
        assert client.get(base + "/" + asset["id"] + "/content").content == reference_wav()


def test_contract_export_is_cpu_only_and_does_not_initialize_storage(tmp_path: Path) -> None:
    output, data_dir = tmp_path / "contract.json", tmp_path / "not-created"
    result = subprocess.run([sys.executable, "-m", "music_api", "openapi", "--data-dir", str(data_dir), "--output", str(output)],
                            capture_output=True, text=True, encoding="utf-8", timeout=15)
    assert result.returncode == 0, result.stderr
    assert not data_dir.exists()
    assert json.loads(output.read_text(encoding="utf-8"))["info"]["title"] == "Music Application API"


def test_unknown_schema_startup_failure_preserves_existing_project(tmp_path: Path) -> None:
    data_dir = tmp_path / "application"
    with server(data_dir, tmp_path / "good-server.log") as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
    with closing(sqlite3.connect(data_dir / "app.sqlite")) as database, database:
        database.execute("UPDATE alembic_version SET version_num='unsupported_revision'")
    result = subprocess.run([sys.executable, "-m", "music_api", "migrate", "--data-dir", str(data_dir)],
                            capture_output=True, text=True, encoding="utf-8", timeout=15)
    assert result.returncode != 0
    assert "unsupported_revision" in result.stderr
    with closing(sqlite3.connect(data_dir / "app.sqlite")) as database, database:
        assert database.execute("SELECT name FROM projects WHERE id=?", (project["id"],)).fetchone()[0] == "Morning song"
        database.execute("UPDATE alembic_version SET version_num='0001_project_audio'")
    with server(data_dir, tmp_path / "restored-server.log") as client:
        assert client.get("/projects/" + project["id"]).json() == project


def test_project_directory_reparse_cannot_escape_application_storage(tmp_path: Path) -> None:
    data_dir = tmp_path / "application"
    outside = tmp_path / "outside-application-assets"
    outside.mkdir()
    with server(data_dir, tmp_path / "reparse-server.log") as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"] + "/assets"
        asset = client.post(base, files={"file": ("reference.wav", reference_wav())}).json()
        project_dir = data_dir / "assets" / project["id"]
        saved_dir = tmp_path / "original-project-files"
        assert project_dir.resolve().is_relative_to(tmp_path.resolve())
        assert saved_dir.resolve().is_relative_to(tmp_path.resolve())
        project_dir.rename(saved_dir)
        target = outside / (asset["id"] + ".wav")
        target.write_bytes(reference_wav())
        if sys.platform == "win32":
            result = subprocess.run(["cmd", "/c", "mklink", "/J", str(project_dir), str(outside)], capture_output=True, timeout=5)
            assert result.returncode == 0, result.stderr
        else:
            project_dir.symlink_to(outside, target_is_directory=True)
        try:
            response = client.get(base + "/" + asset["id"] + "/content")
            assert response.status_code == 409
            assert response.json()["error"]["code"] == "asset_path_invalid"
            assert target.read_bytes() == reference_wav()
        finally:
            if sys.platform == "win32":
                project_dir.rmdir()  # Remove the owned junction itself, preserving its target.
            else:
                project_dir.unlink()
