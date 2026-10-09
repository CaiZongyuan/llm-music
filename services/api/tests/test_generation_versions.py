"""Generate/Candidate/Version checks exercise public isolated CPU application HTTP."""

from pathlib import Path
import time
import pytest
from concurrent.futures import ThreadPoolExecutor
import threading
from sqlalchemy import event
from sqlalchemy.orm import Session

from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.main import create_app
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.version_models import Candidate
from generation_fixture import flac_reference, generated_result, truncated_tail, unknown_count
from test_projects_assets import reference_wav


INPUTS = {"style": "gentle folk pop", "lyrics": "[Verse]\nMorning gathers on the window", "seed": 2026192201}


def generation_app(tmp_path: Path, result=None):
    runtime = None if result is None else FakeInferenceRuntime(results={"Generate": result})
    return create_app(Settings(data_dir=tmp_path, runtime_mode="fake"), runtime=runtime)


def test_production_contract_and_idle_start_do_not_encode_generation_audio(tmp_path: Path, monkeypatch) -> None:
    def premature_encoding(max_seconds=None):
        raise AssertionError("OpenAPI and idle startup must not generate the CPU audio fixture")

    monkeypatch.setattr("music_api.fake_generation.flac_fixture", premature_encoding)
    app = generation_app(tmp_path)
    assert "/projects/{project_id}/jobs/generate" in app.openapi()["paths"]
    assert not tmp_path.joinpath("app.sqlite").exists()
    with TestClient(app) as client:
        assert client.get("/openapi.json").status_code == 200
        assert client.get("/projects").json() == []


def test_generation_input_rejects_empty_creative_intent(tmp_path: Path) -> None:
    with TestClient(generation_app(tmp_path)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        response = client.post("/projects/" + project["id"] + "/jobs/generate",
                               json={"style": "  ", "lyrics": "[Verse]\nMorning", "seed": 2026192201})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_request"


def wait_job(client: TestClient, project_id: str, identifier: str):
    deadline = time.monotonic() + 10
    while True:
        response = client.get("/projects/" + project_id + "/jobs/" + identifier)
        assert response.status_code == 200
        value = response.json()
        if value["status"] in ["completed", "failed", "cancelled"]:
            return value
        if time.monotonic() >= deadline:
            raise AssertionError("Owned fake generation did not reach a terminal application Job")
        time.sleep(min(0.01, max(0, deadline - time.monotonic())))


def test_complete_generation_is_unsaved_candidate_with_owned_audio_and_score(tmp_path: Path) -> None:
    audio = flac_reference()
    with TestClient(generation_app(tmp_path, generated_result(audio))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        response = client.post(base + "/jobs/generate", json=INPUTS)
        assert response.status_code == 202
        job = wait_job(client, project["id"], response.json()["id"])
        assert job["status"] == "completed", job
        candidate = client.get(base + "/candidates/" + job["result"]["candidate_id"]).json()
        assert candidate["job_id"] == job["id"]
        assert candidate["inputs"] == dict(INPUTS, max_seconds=0)
        assert candidate["provenance"]["runtime_kind"] == "fake"
        assert candidate["provenance"]["settings"]["quantization"] == "bf16"
        assert candidate["provenance"]["settings"]["offload"] == "on"
        assert candidate["provenance"]["result_validation"]["note_count"] == 8
        assert candidate["output_snapshot"]["audio"]["sample_width_bits"] == 16
        assert client.get(base + "/versions").json() == []
        assert client.get(base + "/assets/" + candidate["audio_asset_id"] + "/content").content == audio
        assert client.get(base + "/scores/" + candidate["score_id"]).status_code == 200
        assert client.get(base + "/candidates").json() == [candidate]
        for _ in range(3):
            assert client.get(base + "/jobs/" + job["id"]).json()["result"] == job["result"]
        assert len(client.get(base + "/assets").json()) == 2


@pytest.mark.parametrize("case,code", [("missing", "generation_failed"), ("tail", "generated_audio_incomplete"),
                                      ("unknown_count", "generated_audio_unverified")])
def test_incomplete_or_unverified_audio_cannot_create_completed_candidate(tmp_path: Path, case: str, code: str) -> None:
    legal = flac_reference()
    audio = None if case == "missing" else truncated_tail(legal) if case == "tail" else unknown_count(legal)
    with TestClient(generation_app(tmp_path, generated_result(audio))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        source = client.post(base + "/assets", files={"file": ("source.wav", reference_wav())}).json()
        submitted = client.post(base + "/jobs/generate", json=INPUTS).json()
        job = wait_job(client, project["id"], submitted["id"])
        assert job["status"] == "failed"
        assert job["error"]["code"] == code
        assert job["result"] is None
        assert client.get(base + "/candidates").json() == []
        assert client.get(base + "/versions").json() == []
        assert client.get(base + "/assets").json() == [source]
        assert client.get(base + "/assets/" + source["id"] + "/content").content == reference_wav()


def test_explicit_save_is_stable_and_other_intent_cannot_overwrite_it(tmp_path: Path) -> None:
    with TestClient(generation_app(tmp_path)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        submitted = client.post(base + "/jobs/generate", json=INPUTS).json()
        job = wait_job(client, project["id"], submitted["id"])
        intent = {"candidate_id": job["result"]["candidate_id"], "name": " First morning "}
        response = client.post(base + "/versions", json=intent)
        assert response.status_code == 201, response.json()
        version = response.json()
        assert version["name"] == "First morning"
        assert version["inputs"] == dict(INPUTS, max_seconds=0)
        repeated = client.post(base + "/versions", json=intent)
        assert repeated.status_code == 200
        assert repeated.json() == version
        conflict = client.post(base + "/versions", json=dict(intent, name="Another title"))
        assert conflict.status_code == 409
        assert conflict.json()["error"]["code"] == "version_already_saved"
        assert client.get(base + "/versions").json() == [version]
        assert client.get(base + "/versions/" + version["id"]).json() == version


def test_concurrent_identical_save_produces_one_stable_version(tmp_path: Path) -> None:
    with TestClient(generation_app(tmp_path)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        submitted = client.post(base + "/jobs/generate", json=INPUTS).json()
        job = wait_job(client, project["id"], submitted["id"])
        intent = {"candidate_id": job["result"]["candidate_id"], "name": "Concurrent morning"}
        barrier = threading.Barrier(2)

        def save():
            barrier.wait(timeout=5)
            return client.post(base + "/versions", json=intent)

        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(lambda _: save(), range(2)))
        assert sorted(response.status_code for response in responses) == [200, 201]
        assert responses[0].json() == responses[1].json()
        assert client.get(base + "/versions").json() == [responses[0].json()]


def test_durable_version_save_with_lost_acknowledgement_recovers_same_id(tmp_path: Path) -> None:
    armed = {"value": False}

    def lose_acknowledgement(session: Session) -> None:
        if armed["value"]:
            armed["value"] = False
            raise RuntimeError("Injected save acknowledgement loss after durable commit")

    event.listen(Session, "after_commit", lose_acknowledgement)
    try:
        with TestClient(generation_app(tmp_path)) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            submitted = client.post(base + "/jobs/generate", json=INPUTS).json()
            job = wait_job(client, project["id"], submitted["id"])
            intent = {"candidate_id": job["result"]["candidate_id"], "name": "Recovered morning"}
            candidate = client.get(base + "/candidates/" + intent["candidate_id"]).json()
            armed["value"] = True
            response = client.post(base + "/versions", json=intent)
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "version_commit_unconfirmed"
            identifier = response.json()["error"]["resource_id"]
            version = client.get(base + "/versions/" + identifier).json()
            repeated = client.post(base + "/versions", json=intent)
            assert repeated.status_code == 200
            assert repeated.json() == version
            assert version["inputs"] == candidate["inputs"]
            assert version["provenance"] == candidate["provenance"]
            assert client.get(base + "/versions").json() == [version]
    finally:
        event.remove(Session, "after_commit", lose_acknowledgement)


def test_changed_generation_inputs_and_branches_preserve_prior_versions(tmp_path: Path) -> None:
    with TestClient(generation_app(tmp_path)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        versions, original_contents = [], {}
        for index in range(3):
            inputs = dict(INPUTS, style=INPUTS["style"] + str(index), seed=INPUTS["seed"] + index)
            submitted = client.post(base + "/jobs/generate", json=inputs).json()
            job = wait_job(client, project["id"], submitted["id"])
            assert job["status"] == "completed", job
            assert client.get(base + "/versions").json() == versions
            candidate = client.get(base + "/candidates/" + job["result"]["candidate_id"]).json()
            intent = {"candidate_id": candidate["id"], "name": "Morning " + str(index)}
            if versions:
                intent["parent_version_id"] = versions[0]["id"]
            response = client.post(base + "/versions", json=intent)
            assert response.status_code == 201, response.json()
            version = response.json()
            assert version["inputs"] == dict(inputs, max_seconds=0)
            assert version["parent_version_id"] == (versions[0]["id"] if versions else None)
            versions.append(version)
            for identifier in [version["audio_asset_id"], version["output_snapshot"]["score"]["abc_asset_id"]]:
                original_contents[identifier] = client.get(base + "/assets/" + identifier + "/content").content
        assert len({version["audio_asset_id"] for version in versions}) == 3
        for version in versions:
            assert client.get(base + "/versions/" + version["id"]).json() == version
        for identifier, original in original_contents.items():
            assert client.get(base + "/assets/" + identifier + "/content").content == original


def test_generation_accepts_a_user_selected_clip_ceiling(tmp_path: Path) -> None:
    with TestClient(generation_app(tmp_path)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        submitted = client.post(base + "/jobs/generate", json=dict(INPUTS, max_seconds=60)).json()
        job = wait_job(client, project["id"], submitted["id"])
        assert job["status"] == "completed", job
        candidate = client.get(base + "/candidates/" + job["result"]["candidate_id"]).json()
        assert candidate["inputs"]["max_seconds"] == 60
        assert abs(candidate["output_snapshot"]["audio"]["duration_seconds"] - 60) <= 2


def test_generation_rejects_ceilings_outside_the_model_range(tmp_path: Path) -> None:
    with TestClient(generation_app(tmp_path)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        response = client.post(base + "/jobs/generate", json=dict(INPUTS, max_seconds=361))
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_request"


def test_generated_audio_must_not_exceed_its_requested_ceiling(tmp_path: Path) -> None:
    with TestClient(generation_app(tmp_path, generated_result(flac_reference()))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        submitted = client.post(base + "/jobs/generate", json=dict(INPUTS, max_seconds=5)).json()
        job = wait_job(client, project["id"], submitted["id"])
        assert job["status"] == "failed", job
        assert job["error"]["code"] == "generated_audio_profile_mismatch"
        assert client.get(base + "/candidates").json() == []


def test_candidate_and_parent_references_must_belong_to_the_target_project(tmp_path: Path) -> None:
    with TestClient(generation_app(tmp_path)) as client:
        projects = [client.post("/projects", json={"name": title}).json() for title in ["Morning", "Evening"]]
        bases, candidates = [], []
        for project in projects:
            base = "/projects/" + project["id"]
            bases.append(base)
            submitted = client.post(base + "/jobs/generate", json=INPUTS).json()
            job = wait_job(client, project["id"], submitted["id"])
            candidates.append(job["result"]["candidate_id"])
        foreign = client.post(bases[1] + "/versions", json={"candidate_id": candidates[1], "name": "Evening"}).json()
        response = client.post(bases[0] + "/versions", json={"candidate_id": candidates[1], "name": "Foreign candidate"})
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "candidate_not_found"
        assert client.get(bases[0] + "/candidates/" + candidates[1]).status_code == 404
        response = client.post(bases[0] + "/versions", json={"candidate_id": candidates[0], "name": "Morning", "parent_version_id": foreign["id"]})
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "parent_version_not_found"
        assert client.get(bases[0] + "/versions").json() == []
        assert client.get(bases[0] + "/versions/" + foreign["id"]).status_code == 404
        assert client.get(bases[1] + "/versions").json() == [foreign]
        assert client.post(bases[0] + "/versions", json={"candidate_id": candidates[0], "name": "Morning"}).status_code == 201


def test_version_save_failure_before_commit_preserves_candidate_and_can_retry(tmp_path: Path) -> None:
    armed = {"value": False}

    def fail_save(session: Session) -> None:
        if armed["value"]:
            armed["value"] = False
            raise RuntimeError("Injected save failure before durable commit")

    event.listen(Session, "before_commit", fail_save)
    try:
        with TestClient(generation_app(tmp_path)) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            submitted = client.post(base + "/jobs/generate", json=INPUTS).json()
            job = wait_job(client, project["id"], submitted["id"])
            intent = {"candidate_id": job["result"]["candidate_id"], "name": "Retry morning"}
            candidate = client.get(base + "/candidates/" + intent["candidate_id"]).json()
            assets = client.get(base + "/assets").json()
            armed["value"] = True
            response = client.post(base + "/versions", json=intent)
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "version_commit_unconfirmed"
            assert client.get(base + "/versions/" + response.json()["error"]["resource_id"]).status_code == 404
            assert client.get(base + "/versions").json() == []
            assert client.get(base + "/candidates/" + intent["candidate_id"]).json() == candidate
            assert client.get(base + "/assets").json() == assets
            assert client.post(base + "/versions", json=intent).status_code == 201
    finally:
        event.remove(Session, "before_commit", fail_save)


@pytest.mark.parametrize("existing_saved", [False, True], ids=["first-save", "same-intent-repeat"])
def test_lost_save_acknowledgement_with_unavailable_readback_keeps_durable_version(tmp_path: Path, monkeypatch, existing_saved: bool) -> None:
    armed = {"value": False, "block_readback": False}

    def lose_acknowledgement(session: Session) -> None:
        if armed["value"]:
            armed["value"] = False
            armed["block_readback"] = True
            raise RuntimeError("Injected durable save acknowledgement loss")

    event.listen(Session, "after_commit", lose_acknowledgement)
    try:
        app = generation_app(tmp_path)
        with TestClient(app) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            submitted = client.post(base + "/jobs/generate", json=INPUTS).json()
            job = wait_job(client, project["id"], submitted["id"])
            intent = {"candidate_id": job["result"]["candidate_id"], "name": "Unconfirmed morning"}
            original_version = None
            if existing_saved:
                first_save = client.post(base + "/versions", json=intent)
                assert first_save.status_code == 201
                original_version = first_save.json()
            candidate = client.get(base + "/candidates/" + intent["candidate_id"]).json()
            assets = client.get(base + "/assets").json()
            content = {asset["id"]: client.get(base + "/assets/" + asset["id"] + "/content").content for asset in assets}
            sessions = app.state.database.sessions

            def temporarily_unavailable():
                if armed["block_readback"]:
                    raise OSError("Injected independent database readback failure")
                return sessions()

            with monkeypatch.context() as changes:
                changes.setattr(app.state.database, "sessions", temporarily_unavailable)
                armed["value"] = True
                response = client.post(base + "/versions", json=intent)
                assert response.status_code == 503
                assert response.json()["error"]["code"] == "version_commit_unconfirmed"
                assert armed == {"value": False, "block_readback": True}
            identifier = response.json()["error"]["resource_id"]
            if original_version is not None:
                assert identifier == original_version["id"]
            readback = client.get(base + "/versions/" + identifier)
            assert readback.status_code == 200
            version = readback.json()
            if original_version is not None:
                assert version == original_version
            repeated = client.post(base + "/versions", json=intent)
            assert repeated.status_code == 200
            assert repeated.json() == version
            assert client.get(base + "/versions").json() == [version]
            assert client.get(base + "/candidates/" + intent["candidate_id"]).json() == candidate
            assert client.get(base + "/assets").json() == assets
            for asset_id, original in content.items():
                assert client.get(base + "/assets/" + asset_id + "/content").content == original
    finally:
        event.remove(Session, "after_commit", lose_acknowledgement)


@pytest.mark.parametrize("lost_ack", [False, True])
def test_generation_completion_and_candidate_share_one_durable_import(tmp_path: Path, lost_ack: bool) -> None:
    armed = {"value": False, "used": False}

    def fail_before_or_arm_after(session: Session) -> None:
        if not armed["used"] and any(isinstance(item, Candidate) for item in session.new):
            armed["used"] = True
            if not lost_ack:
                raise RuntimeError("Injected Candidate result-set commit failure")
            armed["value"] = True

    def fail_after(session: Session) -> None:
        if armed["value"]:
            armed["value"] = False
            raise RuntimeError("Injected Candidate result-set lost durable acknowledgement")

    event.listen(Session, "before_commit", fail_before_or_arm_after)
    event.listen(Session, "after_commit", fail_after)
    try:
        with TestClient(generation_app(tmp_path)) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            source = client.post(base + "/assets", files={"file": ("reference.wav", reference_wav())}).json()
            submitted = client.post(base + "/jobs/generate", json=INPUTS).json()
            job = wait_job(client, project["id"], submitted["id"])
            assert armed["used"]
            assert client.get(base + "/versions").json() == []
            if lost_ack:
                assert job["status"] == "completed", job
                candidates = client.get(base + "/candidates").json()
                assert len(candidates) == 1
                assert candidates[0]["id"] == job["result"]["candidate_id"]
                assert len(client.get(base + "/assets").json()) == 3
                assert len(client.get(base + "/scores").json()) == 1
                assert wait_job(client, project["id"], job["id"])["result"] == job["result"]
            else:
                assert job["status"] == "failed", job
                assert job["error"]["code"] == "result_persistence_failed"
                assert job["result"] is None
                assert client.get(base + "/candidates").json() == []
                assert client.get(base + "/scores").json() == []
                assert client.get(base + "/assets").json() == [source]
                assert len(list((tmp_path / "assets" / project["id"]).iterdir())) == 1
            assert client.get(base + "/assets/" + source["id"] + "/content").content == reference_wav()
    finally:
        event.remove(Session, "before_commit", fail_before_or_arm_after)
        event.remove(Session, "after_commit", fail_after)
