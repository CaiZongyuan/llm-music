"""Completed native execution is not a cancelled application result while import waits."""

from pathlib import Path
import threading

from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from test_transcription import reference_audio, terminal


def test_cancel_during_saving_retains_complete_owned_results_and_closes_observer(tmp_path: Path) -> None:
    entered, release, stopped = threading.Event(), threading.Event(), threading.Event()

    class ResultGateRuntime(FakeInferenceRuntime):
        def result(self, handle, operation):
            entered.set()
            assert release.wait(timeout=5), "Owned CPU result gate timed out"
            return super().result(handle, operation)

    def configure(jobs):
        jobs.subscription_factory = lambda handle, operation, on_status: stopped.set

    try:
        with TestClient(create_app(Settings(data_dir=tmp_path), runtime=ResultGateRuntime(), configure_jobs=configure)) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            original = reference_audio()
            reference = client.post(base + "/assets", files={"file": ("reference.wav", original)}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + submitted["id"]
            assert entered.wait(timeout=5), "Owned CPU native result did not reach its public gate"
            saving = client.get(address).json()
            assert (saving["status"], saving["phase"], saving["result"]) == ("running", "saving", None)
            late = client.post(address + "/cancel")
            assert late.status_code == 202
            assert (late.json()["status"], late.json()["phase"], late.json()["result"]) == ("running", "saving", None)
            release.set()
            complete = terminal(client, address)
            assert complete["status"] == "completed", complete
            assert complete["error"] is None
            assert len(client.get(base + "/assets").json()) == 3
            assert client.get(base + "/assets/" + complete["result"]["abc_asset_id"] + "/content").status_code == 200
            assert client.get(base + "/assets/" + complete["result"]["midi_asset_id"] + "/content").status_code == 200
            assert client.get(base + "/assets/" + reference["id"] + "/content").content == original
            assert client.post(address + "/cancel").json() == complete
            assert stopped.wait(timeout=2)
    finally:
        release.set()
