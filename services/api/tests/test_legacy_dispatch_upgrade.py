"""A real old API can accept work while its durable 0003 row still says pending."""

from contextlib import closing
import io
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tarfile
import time

from fastapi.testclient import TestClient
import httpx
import pytest

import cancellation_peer as peer_fixture
from cancellation_peer import cancellation_peer
from music_api.config import Settings
from music_api.main import create_app
from test_transcription import reference_audio


BASELINE = "6b704862e0c1c3cc74bc84757422763c8a7f8cb5"


@pytest.mark.parametrize("mode", ["crash", "failed"])
def test_actual_pre_0004_acceptance_pending_row_upgrades_without_cancel_or_duplicate_dispatch(tmp_path: Path, monkeypatch, mode: str) -> None:
    baseline = tmp_path / "baseline"
    baseline.mkdir()
    repository = Path(__file__).resolve().parents[3]
    archive = subprocess.check_output(["git", "-C", str(repository), "archive", BASELINE, "services/api/src"])
    with tarfile.open(fileobj=io.BytesIO(archive)) as content:
        content.extractall(baseline, filter="data")
    if mode == "crash":
        slow = peer_fixture.CANCELLATION_EXTENSION.replace('self.reply({"prompt_id":handle})',
               'if len(native) == 1: __import__("time").sleep(20)\n            self.reply({"prompt_id":handle})')
        monkeypatch.setattr(peer_fixture, "CANCELLATION_EXTENSION", slow)
    with cancellation_peer(tmp_path, monkeypatch) as (url, receipt_path, registry):
        ready, data = tmp_path / "old-ready.json", tmp_path / "application"
        with (tmp_path / "old-api.log").open("wb") as log:
            process = subprocess.Popen([sys.executable, str(Path(__file__).with_name("legacy_api_server.py")),
                       str(baseline / "services/api/src"), str(data), url, str(receipt_path), str(registry.root), str(ready), mode],
                       stdout=log, stderr=log, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            try:
                deadline = time.monotonic() + 15
                while not ready.exists():
                    assert process.poll() is None and time.monotonic() < deadline
                    time.sleep(0.02)
                address = "http://127.0.0.1:" + str(json.loads(ready.read_text(encoding="utf-8"))["port"])
                with httpx.Client(base_url=address, trust_env=False) as old, httpx.Client(base_url=url, trust_env=False) as peer:
                    while True:
                        try:
                            if old.get("/projects").status_code == 200:
                                break
                        except httpx.TransportError:
                            pass
                        assert process.poll() is None and time.monotonic() < deadline
                        time.sleep(0.02)
                    project = old.post("/projects", json={"name": "Morning song"}).json()
                    base = "/projects/" + project["id"]
                    original = reference_audio()
                    reference = old.post(base + "/assets", files={"file": ("reference.wav", original)}).json()
                    submitted = old.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
                    route = base + "/jobs/" + submitted["id"]
                    while peer.get("/facts").json()["target_states"].get("native-1") != "running":
                        assert time.monotonic() < deadline
                        time.sleep(0.02)
                    if mode == "failed":
                        while old.get(route).json()["status"] != "failed":
                            assert time.monotonic() < deadline
                            time.sleep(0.02)
                    old_job = old.get(route).json()
                    process.terminate()
                    process.wait(timeout=10)
                    read_deadline = time.monotonic() + 3
                    while True:
                        try:
                            with closing(sqlite3.connect(data / "app.sqlite")) as database:
                                row = database.execute("SELECT status, submission_state, runtime_handle FROM jobs WHERE id=?", (submitted["id"],)).fetchone()
                                old_schema = database.execute("SELECT version_num FROM alembic_version").fetchone()[0]
                            break
                        except sqlite3.OperationalError:
                            assert time.monotonic() < read_deadline, "Owned hard-stop SQLite recovery did not finish"
                            time.sleep(0.02)
                    assert row == ("queued" if mode == "crash" else "failed", "pending", None)
                    assert old_schema == "0003_generation_versions"
                    settings = Settings(data_dir=data, runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
                    with TestClient(create_app(settings, registry=registry)) as upgraded:
                        current = upgraded.get(route).json()
                        assert current["recovery_required"] is True
                        assert current["inputs"] == old_job["inputs"]
                        assert current["provenance"] == old_job["provenance"]
                        assert current["error"] and current["error"]["recovery"]
                        if mode == "failed":
                            assert current["error"] == old_job["error"]
                        cancelled = upgraded.post(route + "/cancel")
                        assert cancelled.status_code == (409 if mode == "crash" else 200), cancelled.text
                        assert upgraded.get(route).json()["status"] != "cancelled"
                        assert upgraded.post(route + "/retry").status_code == 409
                        assert peer.get("/accepted").json()["count"] == 1
                        assert peer.get("/facts").json()["target_states"]["native-1"] == "running"
                        assert upgraded.get(base + "/assets/" + reference["id"] + "/content").content == original
            finally:
                if process.poll() is None:
                    process.terminate()
                    process.wait(timeout=10)
