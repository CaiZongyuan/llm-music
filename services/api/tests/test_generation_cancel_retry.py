"""Generation cancellation/retry cannot mutate explicitly saved versions or original bytes."""

from pathlib import Path
import json

from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from music_api.runtime_types import RuntimeRequest, RuntimeStatus, SubmissionReceipt
from test_cancel_retry import wait_running
from test_generation_versions import INPUTS
from test_transcription import terminal


class GenerationScenarios(FakeInferenceRuntime):
    def __init__(self) -> None:
        super().__init__(result_factories={"Generate": generation_fixture})
        self.scenarios: dict[str, int] = {}

    def submit(self, request: RuntimeRequest) -> SubmissionReceipt:
        receipt = super().submit(request)
        if receipt.handle is not None:
            self.scenarios[receipt.handle] = len(self.scenarios) + 1
        return receipt

    def status(self, handle: str) -> RuntimeStatus:
        current = super().status(handle)
        if current.state == "cancelled":
            return current
        if self.scenarios[handle] == 2:
            return RuntimeStatus("running", "planning_score")
        if self.scenarios[handle] == 3:
            return RuntimeStatus("failed", code="runtime_execution_failed", message="INTERNAL synthetic generation failure")
        return current


def test_generation_cancel_failure_and_explicit_retry_preserve_saved_history(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path), runtime=GenerationScenarios())) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        first = client.post(base + "/jobs/generate", json=INPUTS).json()
        complete = terminal(client, base + "/jobs/" + first["id"])
        assert complete["status"] == "completed"
        saved = client.post(base + "/versions", json={"candidate_id": complete["result"]["candidate_id"], "name": "First morning"}).json()
        original_assets = client.get(base + "/assets").json()
        contents = {asset["id"]: client.get(base + "/assets/" + asset["id"] + "/content").content for asset in original_assets}
        assert client.post(base + "/jobs/" + first["id"] + "/cancel").json() == complete
        assert client.post(base + "/jobs/" + first["id"] + "/retry").status_code == 409
        held = client.post(base + "/jobs/generate", json=dict(INPUTS, seed=INPUTS["seed"] + 1)).json()
        address = base + "/jobs/" + held["id"]
        wait_running(client, address)
        other = client.post("/projects", json={"name": "Evening song"}).json()
        foreign = "/projects/" + other["id"] + "/jobs/" + held["id"]
        assert client.post(foreign + "/cancel").status_code == 404
        assert client.post(foreign + "/retry").status_code == 404
        assert client.get(address).json()["cancel_requested"] is False
        assert client.post(address + "/cancel").status_code == 200
        cancelled = terminal(client, address)
        assert cancelled["status"] == "cancelled"
        failing = client.post(base + "/jobs/generate", json=dict(INPUTS, seed=INPUTS["seed"] + 2)).json()
        failed_address = base + "/jobs/" + failing["id"]
        failed = terminal(client, failed_address)
        assert failed["error"]["code"] == "generation_failed"
        assert "INTERNAL" not in json.dumps(failed)
        retry = client.post(failed_address + "/retry")
        assert retry.status_code == 202, retry.text
        retried = terminal(client, base + "/jobs/" + retry.json()["id"])
        assert retried["status"] == "completed", retried
        assert retried["inputs"] == failed["inputs"]
        assert client.get(address).json() == cancelled
        assert client.get(failed_address).json() == failed
        assert client.get(base + "/versions").json() == [saved]
        assert client.get(base + "/versions/" + saved["id"]).json() == saved
        for asset in original_assets:
            assert client.get(base + "/assets/" + asset["id"]).json() == asset
            assert client.get(base + "/assets/" + asset["id"] + "/content").content == contents[asset["id"]]
