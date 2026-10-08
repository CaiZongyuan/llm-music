"""Selected Score requests use the public application HTTP boundary."""

from pathlib import Path
import threading
import hashlib
from dataclasses import replace

import pytest

from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.main import create_app
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.fake_generation import generation_fixture
from music_api.runtime_types import RuntimeStatus
from test_generation_versions import INPUTS, wait_job


SELECTED_ABC = ('X:1\nT:\nM:4/4\nL:1/16\nQ:1/4=96\n'
                'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"\n'
                'V: Ins clef=treble name="Ins Melody" snm="Inst."\n'
                'K:C\n% verse\nV: Vocal\n"C"C4 D4 E4 G4 |\nV: Ins\nz16 |')


class SelectedScenarios(FakeInferenceRuntime):
    def __init__(self):
        super().__init__(result_factories={"Generate": generation_fixture, "GenerateFromScore": generation_fixture})
        self.complete = threading.Event()

    def status(self, handle):
        request = self._requests[handle][0]
        current = super().status(handle)
        if request.operation == "GenerateFromScore" and current.state != "cancelled" and not self.complete.is_set():
            return RuntimeStatus("running", "generating_semantic")
        return current


def source_version(client, base):
    submitted = client.post(base + "/jobs/generate", json=INPUTS)
    assert submitted.status_code == 202
    job = wait_job(client, base.split("/")[-1], submitted.json()["id"])
    assert job["status"] == "completed", job
    response = client.post(base + "/versions", json={"candidate_id": job["result"]["candidate_id"], "name": "Original morning"})
    assert response.status_code == 201
    return response.json()


def test_invalid_selected_abc_is_rejected_without_creating_job(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        version = source_version(client, base)
        original_jobs = client.get(base + "/jobs").json()
        response = client.post(base + "/jobs/generate-from-score", json=dict(INPUTS, abc="X:1\nK:C\nnot music",
                               source_score_id=version["score_id"], parent_version_id=version["id"]))
        assert response.status_code == 422, response.json()
        assert response.json()["error"]["code"] == "score_invalid"
        assert client.get(base + "/jobs").json() == original_jobs


def test_selected_input_is_immutable_through_running_candidate_and_explicit_parent_save(tmp_path: Path) -> None:
    runtime = SelectedScenarios()
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"), runtime=runtime)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        original_assets = client.get(base + "/assets").json()
        original_bytes = {asset["id"]: client.get(base + "/assets/" + asset["id"] + "/content").content for asset in original_assets}
        selected = dict(INPUTS, abc=SELECTED_ABC, source_score_id=original["score_id"], parent_version_id=original["id"], max_seconds=35)
        response = client.post(base + "/jobs/generate-from-score", json=selected)
        assert response.status_code == 202, response.json()
        job_id = response.json()["id"]
        selected["abc"] = "broken next draft"
        selected["style"] = "a different style after submit"
        live = client.get(base + "/jobs/" + job_id).json()
        assert live["operation"] == "GenerateFromScore"
        assert live["inputs"]["abc"] == SELECTED_ABC
        assert live["inputs"]["style"] == INPUTS["style"]
        assert live["provenance"]["selected_score"]["abc_sha256"] == hashlib.sha256(SELECTED_ABC.encode()).hexdigest()
        assert client.get("/runtime/diagnostics").status_code == 200
        runtime.complete.set()
        job = wait_job(client, project["id"], job_id)
        assert job["status"] == "completed", job
        candidate = client.get(base + "/candidates/" + job["result"]["candidate_id"]).json()
        assert candidate["inputs"] == live["inputs"]
        assert client.get(base + "/assets/" + candidate["output_snapshot"]["score"]["abc_asset_id"] + "/content").content == SELECTED_ABC.encode()
        assert client.get(base + "/versions").json() == [original]
        save = client.post(base + "/versions", json={"candidate_id": candidate["id"], "name": "Selected melody"})
        assert save.status_code == 201, save.json()
        version = save.json()
        assert version["parent_version_id"] == original["id"]
        assert version["inputs"] == candidate["inputs"]
        assert client.get(base + "/versions/" + original["id"]).json() == original
        for asset in original_assets:
            assert client.get(base + "/assets/" + asset["id"]).json() == asset
            assert client.get(base + "/assets/" + asset["id"] + "/content").content == original_bytes[asset["id"]]


@pytest.mark.parametrize("case,code,status", [("foreign_score", "score_not_found", 404),
    ("foreign_parent", "parent_version_not_found", 404), ("wrong_parent_score", "source_parent_mismatch", 409),
    ("invalid_bar", "score_invalid", 422)])
def test_invalid_source_or_native_abc_does_not_create_work(tmp_path: Path, case: str, code: str, status: int) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        other = client.post("/projects", json={"name": "Another song"}).json()
        foreign = source_version(client, "/projects/" + other["id"])
        selected = dict(INPUTS, abc=SELECTED_ABC, source_score_id=original["score_id"], parent_version_id=original["id"])
        if case == "foreign_score":
            selected["source_score_id"] = foreign["score_id"]
        elif case == "foreign_parent":
            selected["parent_version_id"] = foreign["id"]
        elif case == "wrong_parent_score":
            second = client.post(base + "/jobs/generate", json=INPUTS).json()
            selected["source_score_id"] = wait_job(client, project["id"], second["id"])["result"]["score_id"]
        else:
            selected["abc"] = SELECTED_ABC.replace("C4 D4 E4 G4", "C4 D4 E4")
        prior = client.get(base + "/jobs").json()
        response = client.post(base + "/jobs/generate-from-score", json=selected)
        assert response.status_code == status, response.json()
        assert response.json()["error"]["code"] == code
        assert client.get(base + "/jobs").json() == prior
        assert client.get(base + "/versions").json() == [original]


def test_missing_selected_score_capability_does_not_fall_back_to_generate(tmp_path: Path) -> None:
    runtime = FakeInferenceRuntime(result_factories={"Generate": generation_fixture})
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"), runtime=runtime)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        prior = client.get(base + "/jobs").json()
        capability = next(item for item in client.get("/runtime/capabilities").json()["capabilities"] if item["operation"] == "GenerateFromScore")
        assert capability["ready"] is False
        response = client.post(base + "/jobs/generate-from-score", json=dict(INPUTS, abc=SELECTED_ABC, source_score_id=original["score_id"]))
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "capability_missing"
        assert client.get(base + "/jobs").json() == prior


class InvalidSelectedOutput(FakeInferenceRuntime):
    def __init__(self, case):
        super().__init__(result_factories={"Generate": generation_fixture, "GenerateFromScore": generation_fixture})
        self.case = case

    def result(self, handle, operation):
        result = super().result(handle, operation)
        if operation == "GenerateFromScore":
            if self.case == "source_metadata":
                return replace(result, provenance=dict(result.provenance, selected_score={"abc_sha256": "a different request"}))
            role = "abc" if self.case == "wrong_score" else "audio"
            data = SELECTED_ABC.replace("D4", "F4").encode() if role == "abc" else b"broken FLAC"
            result = replace(result, artifacts=tuple(replace(item, data=data) if item.role == role else item for item in result.artifacts))
        return result


@pytest.mark.parametrize("case,code", [("wrong_score", "score_result_mismatch"), ("broken_audio", "generated_audio_invalid")])
def test_failed_selected_output_publishes_no_candidate_or_assets(tmp_path: Path, case: str, code: str) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"), runtime=InvalidSelectedOutput(case))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        assets = client.get(base + "/assets").json()
        candidates = client.get(base + "/candidates").json()
        submitted = client.post(base + "/jobs/generate-from-score", json=dict(INPUTS, abc=SELECTED_ABC, source_score_id=original["score_id"], parent_version_id=original["id"])).json()
        job = wait_job(client, project["id"], submitted["id"])
        assert job["status"] == "failed", job
        assert job["error"]["code"] == code
        assert job["result"] is None
        assert client.get(base + "/candidates").json() == candidates
        assert client.get(base + "/assets").json() == assets
        assert client.get(base + "/versions").json() == [original]


def test_runtime_result_metadata_cannot_replace_the_selected_input_snapshot(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"), runtime=InvalidSelectedOutput("source_metadata"))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        selected = dict(INPUTS, abc=SELECTED_ABC, source_score_id=original["score_id"])
        submitted = client.post(base + "/jobs/generate-from-score", json=selected).json()
        complete = wait_job(client, project["id"], submitted["id"])
        assert complete["status"] == "completed", complete
        candidate = client.get(base + "/candidates/" + complete["result"]["candidate_id"]).json()
        assert candidate["provenance"]["selected_score"]["abc_sha256"] == hashlib.sha256(SELECTED_ABC.encode()).hexdigest()
        assert candidate["provenance"]["selected_score"]["effective_abc"] == SELECTED_ABC


def test_cancel_queued_and_running_selection_then_explicit_retry_retains_abc_and_parent(tmp_path: Path) -> None:
    runtime = SelectedScenarios()
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"), runtime=runtime)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        selected = dict(INPUTS, abc=SELECTED_ABC, source_score_id=original["score_id"], parent_version_id=original["id"])
        first = client.post(base + "/jobs/generate-from-score", json=selected).json()
        second = client.post(base + "/jobs/generate-from-score", json=dict(selected, seed=2026410002)).json()
        queued = client.post(base + "/jobs/" + second["id"] + "/cancel")
        assert queued.status_code == 200 and queued.json()["status"] == "cancelled"
        running = client.post(base + "/jobs/" + first["id"] + "/cancel")
        assert running.status_code == 200 and running.json()["status"] == "cancelled"
        retried = client.post(base + "/jobs/" + first["id"] + "/retry")
        assert retried.status_code == 202
        assert retried.json()["inputs"] == running.json()["inputs"]
        runtime.complete.set()
        completed = wait_job(client, project["id"], retried.json()["id"])
        assert completed["status"] == "completed", completed
        assert completed["provenance"]["retry_of_job_id"] == first["id"]
        assert client.get(base + "/versions").json() == [original]
        assert client.get(base + "/jobs/" + second["id"]).json() == queued.json()
        assert client.get(base + "/jobs/" + first["id"]).json() == running.json()


@pytest.mark.parametrize("source", ["transcribed", "bare", "marked"])
def test_selected_native_score_adaptation_preserves_music_and_records_original_and_effective_abc(tmp_path: Path, source: str) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        abc, source_score_id = SELECTED_ABC, original["score_id"]
        if source == "transcribed":
            from test_transcription import reference_audio
            reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
            transcribed = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            complete = wait_job(client, project["id"], transcribed["id"])
            source_score_id = complete["result"]["score_id"]
            abc = client.get(base + "/assets/" + complete["result"]["abc_asset_id"] + "/content").text
            effective, transformations = abc.strip(), []
        elif source == "bare":
            abc = SELECTED_ABC.replace("% verse\n", "")
            effective = SELECTED_ABC.replace("% verse", "% selected score")
            transformations = ["preserve_bare_score_sections"]
        else:
            abc = SELECTED_ABC + "\n%yue2-words 0000000000000000"
            effective, transformations = SELECTED_ABC, ["remove_native_words_marker"]
        selected = dict(INPUTS, abc=abc, source_score_id=source_score_id)
        submitted = client.post(base + "/jobs/generate-from-score", json=selected)
        assert submitted.status_code == 202, submitted.json()
        completed = wait_job(client, project["id"], submitted.json()["id"])
        assert completed["status"] == "completed", completed
        assert completed["inputs"]["abc"] == abc
        snapshot = completed["provenance"]["selected_score"]
        assert snapshot["effective_abc"] == effective
        assert snapshot["transformations"] == transformations
        assert snapshot["abc_sha256"] == hashlib.sha256(abc.encode()).hexdigest()
        assert snapshot["effective_abc_sha256"] == hashlib.sha256(effective.encode()).hexdigest()
        output = client.get(base + "/assets/" + completed["result"]["abc_asset_id"] + "/content").text
        assert output == effective
        from music_api.vendor.yue2_music.abc_tools import parse_abc
        before = parse_abc(SELECTED_ABC if source == "marked" else abc.strip())
        after = parse_abc(output)
        assert before.bpm == after.bpm
        for voice in ("Vocal", "Ins"):
            assert before.voices[voice].notes == after.voices[voice].notes
            assert before.voices[voice].bars == after.voices[voice].bars
