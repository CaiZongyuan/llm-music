"""A public Project writer cannot turn a running Job into a failed cancellation."""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import threading
import time

from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from music_api.config import Settings
from music_api.main import create_app
from music_api.fake_runtime import FakeInferenceRuntime
from test_cancel_retry import wait_running
from test_generation_cancel_retry import GenerationScenarios
from test_generation_versions import INPUTS
from test_transcription import terminal


def test_external_project_commit_between_job_read_and_write_preserves_cancel_and_saved_bytes(tmp_path: Path) -> None:
    read, release, ended = threading.Event(), threading.Event(), threading.Event()
    probe = {"armed": False, "fired": False, "errors": []}

    def after_read(connection, cursor, statement, parameters, context, executemany):
        if probe["armed"] and threading.current_thread().name == "application-jobs" and statement.lstrip().startswith("SELECT") and "FROM jobs" in statement:
            probe["armed"], probe["fired"] = False, True
            read.set()
            assert release.wait(timeout=5), "Owned provider read barrier timed out"

    def on_error(context):
        if probe["fired"] and threading.current_thread().name == "application-jobs":
            original = context.original_exception
            probe["errors"].append({"code": getattr(original, "sqlite_errorcode", None), "name": getattr(original, "sqlite_errorname", None)})

    def transaction_ended(session, transaction):
        if probe["fired"] and transaction.parent is None and threading.current_thread().name == "application-jobs":
            ended.set()

    event.listen(Engine, "after_cursor_execute", after_read)
    event.listen(Engine, "handle_error", on_error)
    event.listen(Session, "after_transaction_end", transaction_ended)
    try:
        with TestClient(create_app(Settings(data_dir=tmp_path), runtime=GenerationScenarios())) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            first = client.post(base + "/jobs/generate", json=INPUTS).json()
            complete = terminal(client, base + "/jobs/" + first["id"])
            saved = client.post(base + "/versions", json={"candidate_id": complete["result"]["candidate_id"], "name": "First morning"}).json()
            assets = client.get(base + "/assets").json()
            content = {asset["id"]: client.get(base + "/assets/" + asset["id"] + "/content").content for asset in assets}
            submitted = client.post(base + "/jobs/generate", json=dict(INPUTS, seed=INPUTS["seed"] + 1)).json()
            address = base + "/jobs/" + submitted["id"]
            wait_running(client, address)
            probe["armed"] = True
            assert read.wait(timeout=5), "Owned Job read did not reach provider barrier"
            with ThreadPoolExecutor(max_workers=1) as executor:
                writer = executor.submit(lambda: client.post("/projects", json={"name": "Evening song"}))
                try:
                    # A deferred reader permits this unrelated public write. A local
                    # writer reservation may serialize it; release either way.
                    writer.result(timeout=1)
                except TimeoutError:
                    pass
                finally:
                    release.set()
                assert writer.result(timeout=5).status_code == 201
            assert ended.wait(timeout=5)
            if probe["errors"]:
                deadline = time.monotonic() + 2
                while client.get(address).json()["status"] != "failed":
                    assert time.monotonic() < deadline
                    time.sleep(0.01)
            result = client.post(address + "/cancel")
            assert result.status_code == 200, result.text
            final = terminal(client, address)
            (tmp_path / "writer-race.json").write_text(json.dumps(dict(probe, returned_status=final["status"]), indent=2), encoding="utf-8")
            assert final["status"] == "cancelled", {"job": final, "provider_errors": probe["errors"]}
            assert probe["errors"] == []
            assert client.get(base + "/versions/" + saved["id"]).json() == saved
            for asset_id, original in content.items():
                assert client.get(base + "/assets/" + asset_id + "/content").content == original
    finally:
        release.set()
        event.remove(Engine, "after_cursor_execute", after_read)
        event.remove(Engine, "handle_error", on_error)
        event.remove(Session, "after_transaction_end", transaction_ended)


def test_external_project_commit_at_import_snapshot_retains_one_complete_owned_result(tmp_path: Path) -> None:
    result_ready, result_release, read, release = (threading.Event() for _ in range(4))
    probe = {"armed": False, "fired": False, "errors": []}

    class ResultGateRuntime(FakeInferenceRuntime):
        def result(self, handle, operation):
            result_ready.set()
            assert result_release.wait(timeout=5)
            return super().result(handle, operation)

    def after_read(connection, cursor, statement, parameters, context, executemany):
        if probe["armed"] and threading.current_thread().name == "application-jobs" and statement.lstrip().startswith("SELECT") and "FROM jobs" in statement:
            probe["armed"], probe["fired"] = False, True
            read.set()
            assert release.wait(timeout=5)

    def on_error(context):
        if probe["fired"] and threading.current_thread().name == "application-jobs":
            original = context.original_exception
            probe["errors"].append({"code": getattr(original, "sqlite_errorcode", None), "name": getattr(original, "sqlite_errorname", None)})

    event.listen(Engine, "after_cursor_execute", after_read)
    event.listen(Engine, "handle_error", on_error)
    try:
        from test_transcription import reference_audio
        with TestClient(create_app(Settings(data_dir=tmp_path), runtime=ResultGateRuntime())) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            original = reference_audio()
            reference = client.post(base + "/assets", files={"file": ("reference.wav", original)}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + submitted["id"]
            assert result_ready.wait(timeout=5)
            assert client.get(address).json()["phase"] == "saving"
            probe["armed"] = True
            result_release.set()
            assert read.wait(timeout=5)
            with ThreadPoolExecutor(max_workers=1) as executor:
                writer = executor.submit(lambda: client.post("/projects", json={"name": "Evening song"}))
                try:
                    writer.result(timeout=1)
                except TimeoutError:
                    pass
                finally:
                    release.set()
                assert writer.result(timeout=5).status_code == 201
            complete = terminal(client, address)
            assert complete["status"] == "completed", {"job": complete, "provider_errors": probe["errors"]}
            assert probe["errors"] == []
            assert len(client.get(base + "/assets").json()) == 3
            assert len(client.get(base + "/scores").json()) == 1
            for name in ("abc_asset_id", "midi_asset_id"):
                assert client.get(base + "/assets/" + complete["result"][name] + "/content").status_code == 200
            assert client.get(base + "/assets/" + reference["id"] + "/content").content == original
    finally:
        result_release.set()
        release.set()
        event.remove(Engine, "after_cursor_execute", after_read)
        event.remove(Engine, "handle_error", on_error)
