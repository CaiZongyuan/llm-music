"""Public WS snapshots follow durable HTTP state through external event/commit loss."""

import json
from contextlib import ExitStack
from pathlib import Path
import threading
import time

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import event
from sqlalchemy.orm import Session

from music_api.config import Settings
from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.job_models import Job
from music_api.main import create_app
from music_api.runtime_types import RuntimeStatus
from test_transcription import reference_audio


@pytest.mark.parametrize("operation", ["Transcribe", "Generate"])
def test_ws_unknown_progress_saving_and_reconnect_recover_the_same_durable_result(tmp_path: Path, operation: str) -> None:
    native_finished, commit_entered, allow_commit = threading.Event(), threading.Event(), threading.Event()

    class ExternalRuntimeFixture(FakeInferenceRuntime):
        def status(self, handle: str) -> RuntimeStatus:
            if native_finished.is_set():
                return RuntimeStatus("completed")
            return RuntimeStatus("running", "transcribing" if operation == "Transcribe" else "synthesizing", None)

    def hold_result_commit(session: Session) -> None:
        if any(isinstance(item, Job) and item.status == "completed" for item in session.identity_map.values()):
            commit_entered.set()
            assert allow_commit.wait(timeout=10), "External result commit gate was not released"

    event.listen(Session, "before_commit", hold_result_commit)
    runtime = ExternalRuntimeFixture(result_factories={"Generate": generation_fixture})
    try:
        with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"), runtime=runtime)) as client, ExitStack() as cleanup:
            cleanup.callback(allow_commit.set)
            cleanup.callback(native_finished.set)
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            original = reference_audio()
            source = client.post(base + "/assets", files={"file": ("reference.wav", original)}).json()
            if operation == "Transcribe":
                response = client.post(base + "/transcriptions", json={"reference_asset_id": source["id"]})
            else:
                response = client.post(base + "/jobs/generate", json={"style": "gentle folk pop", "lyrics": "Morning gathers on the window", "seed": 2026192201})
            assert response.status_code == 202
            identifier = response.json()["id"]
            job_url = base + "/jobs/" + identifier
            with client.websocket_connect(job_url + "/events") as websocket:
                while True:
                    message = websocket.receive_json()
                    assert message["job"]["id"] == identifier
                    assert message["job"]["project_id"] == project["id"]
                    assert message["job"]["progress"] is None
                    assert "prompt_id" not in json.dumps(message) and "node_id" not in json.dumps(message)
                    if message["job"]["status"] == "running":
                        assert message["job"]["phase"] == ("transcribing" if operation == "Transcribe" else "synthesizing")
                        break
                native_finished.set()
                assert commit_entered.wait(timeout=5)
                before_commit = client.get(job_url).json()
                assert before_commit["status"] == "running"
                assert before_commit["phase"] == "saving"
                assert before_commit["progress"] is None
                assert before_commit["result"] is None
                saving = websocket.receive_json()
                assert saving["job"]["status"] == "running"
                assert saving["job"]["phase"] == "saving"
                assert saving["job"]["result"] is None
            # This client deliberately misses the completion event and recovers by HTTP.
            allow_commit.set()
            deadline = time.monotonic() + 5
            while True:
                durable = client.get(job_url).json()
                if durable["status"] in {"completed", "failed", "cancelled"}:
                    break
                assert time.monotonic() < deadline
                time.sleep(0.01)
            assert durable["status"] == "completed", durable
            with client.websocket_connect(job_url + "/events") as websocket:
                recovered = websocket.receive_json()["job"]
                assert recovered == durable
            assets = client.get(base + "/assets").json()
            assert len(assets) == 3
            assert client.get(base + "/assets/" + source["id"] + "/content").content == original
            for role in (["abc", "midi"] if operation == "Transcribe" else ["abc", "audio"]):
                assert client.get(base + "/assets/" + durable["result"][role + "_asset_id"] + "/content").content
            assert client.get(job_url).json() == durable
    finally:
        native_finished.set()
        allow_commit.set()
        event.remove(Session, "before_commit", hold_result_commit)
