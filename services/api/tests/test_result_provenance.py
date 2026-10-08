"""Runtime observations cannot rewrite durable application input/provenance snapshots."""

from dataclasses import replace
from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from music_api.config import Settings
from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from test_generate_from_score import source_version
from test_generation_versions import INPUTS, wait_job


class AnnotatedRuntime(FakeInferenceRuntime):
    def __init__(self):
        super().__init__(result_factories={"Generate": generation_fixture, "GenerateFromScore": generation_fixture})
        self.annotate = False

    def result(self, handle, operation):
        result = super().result(handle, operation)
        if not self.annotate:
            return result
        return replace(result, provenance=dict(result.provenance,
            workflow_id="annotation-other-workflow", workflow_version="999", runtime_kind="comfyui",
            settings={"cot": "off", "transpose": 12}, models=[{"id": "a different model", "revision": "unknown"}],
            runtime_revision="a different Runtime", plugin_revision="a different plugin",
            manifest_sha256="a different manifest", definition_sha256="a different definition",
            selected_score={"abc_sha256": "a different request"},
            result_validation={"valid": False, "note_count": 0},
            execution_seconds=1.25, core_cached=False, timing_scope="Identified CPU observation; no GPU"))


@pytest.mark.parametrize("operation", ["Generate", "GenerateFromScore"])
def test_result_preserves_all_frozen_provenance_and_records_actual_validation_and_new_observations(tmp_path: Path, operation: str) -> None:
    runtime = AnnotatedRuntime()
    app = create_app(Settings(data_dir=tmp_path, runtime_mode="fake"), runtime=runtime)
    with TestClient(app) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        parent = source_version(client, base)
        inputs = dict(INPUTS)
        if operation == "GenerateFromScore":
            abc = client.get(base + "/assets/" + parent["output_snapshot"]["score"]["abc_asset_id"] + "/content").text
            inputs.update(abc=abc.replace("D4", "F4", 1), source_score_id=parent["score_id"], parent_version_id=parent["id"])
        runtime.annotate = True
        submitted = client.post(base + "/jobs/" + ("generate" if operation == "Generate" else "generate-from-score"), json=inputs)
        assert submitted.status_code == 202
        accepted = submitted.json()
        complete = wait_job(client, project["id"], accepted["id"])
        assert complete["status"] == "completed", complete
        candidate = client.get(base + "/candidates/" + complete["result"]["candidate_id"]).json()
        saved = client.post(base + "/versions", json={"candidate_id": candidate["id"], "name": "Retained melody"})
        assert saved.status_code == 201
        version = saved.json()
        for result in (complete, candidate, version):
            assert result["inputs"] == accepted["inputs"]
            for key, value in accepted["provenance"].items():
                assert result["provenance"][key] == value, (key, result["provenance"][key], value)
            assert result["provenance"]["result_validation"]["valid"] is True
            assert result["provenance"]["result_validation"]["note_count"] == 8
            assert result["provenance"]["execution_seconds"] == 1.25
            assert result["provenance"]["core_cached"] is False
            assert result["provenance"]["timing_scope"] == "Identified CPU observation; no GPU"
        assert client.get(base + "/versions/" + parent["id"]).json() == parent
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"))) as client:
        assert client.get(base + "/jobs/" + complete["id"]).json() == complete
        assert client.get(base + "/candidates/" + candidate["id"]).json() == candidate
        assert client.get(base + "/versions/" + version["id"]).json() == version
