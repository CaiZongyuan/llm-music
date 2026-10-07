"""External observations enter the worker; HTTP and durable results remain authoritative."""

from pathlib import Path
import threading
import time

from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from music_api.runtime_types import RuntimeStatus
from test_transcription import reference_audio, terminal


def test_owned_phase_observations_cannot_complete_a_job_and_stream_closes(tmp_path: Path) -> None:
    release, stopped = threading.Event(), threading.Event()
    source = {}

    class HeldRuntime(FakeInferenceRuntime):
        def status(self, handle: str) -> RuntimeStatus:
            return super().status(handle) if release.is_set() else RuntimeStatus("running")

    def subscribe(handle, operation, on_status):
        source["send"] = on_status
        on_status(RuntimeStatus("running", "transcribing"))
        return stopped.set

    def configure(jobs):
        jobs.subscription_factory = subscribe

    def wait_phase(client, address, expected):
        deadline = time.monotonic() + 5
        while True:
            job = client.get(address).json()
            if job["phase"] == expected:
                return job
            assert time.monotonic() < deadline, job
            time.sleep(0.01)

    try:
        with TestClient(create_app(Settings(data_dir=tmp_path), runtime=HeldRuntime(), configure_jobs=configure)) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + submitted["id"]
            running = wait_phase(client, address, "transcribing")
            assert running["status"] == "running"
            assert running["progress"] is None
            source["send"](RuntimeStatus("completed"))
            source["send"](RuntimeStatus("running", "loading_model"))
            for _ in range(3):
                current = client.get(address).json()
                assert current["status"] == "running"
                assert current["phase"] == "transcribing"
                assert current["result"] is None
            source["send"](RuntimeStatus("unconfirmed", code="native_event_source_lost"))
            assert wait_phase(client, address, None)["progress"] is None
            release.set()
            complete = terminal(client, address)
            assert complete["status"] == "completed", complete
            assert complete["result"]["abc_asset_id"]
            assert stopped.wait(timeout=2), "Owned observation source did not close"
            assert client.get(address).json() == complete
    finally:
        release.set()
