"""Cover is verified through public HTTP and immutable source files, without GPU."""

from io import BytesIO
from pathlib import Path
from uuid import uuid4
import hashlib
import wave

import av
import numpy as np
import pytest
from av.audio.stream import AudioStream
from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.main import create_app
from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.runtime_types import RuntimeArtifact
from dataclasses import replace
import threading
from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from music_api.reference_audio import ReferenceOrigin
from music_api.runtime_types import RuntimeStatus
from test_generate_from_score import source_version
from test_generation_versions import wait_job
from test_generation_versions import INPUTS
from test_transcription import reference_audio


SELECTED = ('X:1\nT:\nM:4/4\nL:1/16\nQ:1/4=96\n'
            'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"\n'
            'V: Ins clef=treble name="Ins Melody" snm="Inst."\n'
            'K:C\n% verse\nV: Vocal\n"C"C4 D4 E4 G4 |\nV: Ins\nC,8 G,8 |')
EFFECTIVE = ('X:1\nT:\nM:4/4\nL:1/16\nQ:1/4=96\n'
             'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"\n'
             'V: Ins clef=treble name="Ins Melody" snm="Inst."\n'
             'K:C\n% verse\nV: Vocal\nC4 D4 E4 G4 |\nV: Ins\nC,8 G,8 |')


def cover_selection(client, base):
    reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
    transcribed = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
    job = wait_job(client, base.split("/")[-1], transcribed["id"])
    assert job["status"] == "completed", job
    saved = client.post(base + "/scores", json={"abc": SELECTED, "source_score_id": job["result"]["score_id"]}).json()
    return reference, saved, job


def test_explicit_melody_cover_freezes_both_voice_chordless_input_and_keeps_reference_lineage(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"))) as client:
        project = client.post("/projects", json={"name": "Morning cover"}).json()
        base = "/projects/" + project["id"]
        reference, saved, transcribed = cover_selection(client, base)
        checked = client.post(base + "/cover-inputs/validate", json={"abc": SELECTED, "mode": "melody"})
        assert checked.status_code == 200, checked.text
        assert checked.json()["effective_abc"] == EFFECTIVE
        selected = dict(INPUTS, abc=SELECTED, source_score_id=saved["id"], reference_asset_id=reference["id"], mode="melody",
                        effective_abc_sha256=hashlib.sha256(EFFECTIVE.encode()).hexdigest(), mode_transform_version="1.0.0", parent_version_id=None, max_seconds=35)
        submitted = client.post(base + "/jobs/cover", json=selected)
        assert submitted.status_code == 202, submitted.text
        completed = wait_job(client, project["id"], submitted.json()["id"])
        assert completed["status"] == "completed", completed
        assert completed["operation"] == "Cover"
        assert completed["inputs"] == selected
        assert completed["provenance"]["settings"]["cot"] == "melody"
        assert completed["provenance"]["selected_score"]["effective_abc"] == EFFECTIVE
        assert completed["provenance"]["cover_source"]["transcribe_job_id"] == transcribed["id"]
        candidate = client.get(base + "/candidates/" + completed["result"]["candidate_id"]).json()
        assert candidate["inputs"] == selected
        output_score = client.get(base + "/scores/" + candidate["score_id"]).json()
        assert output_score["source_reference_asset_id"] == reference["id"]
        assert output_score["source_score_id"] == saved["id"]
        assert client.get(base + "/assets/" + output_score["abc_asset_id"] + "/content").text == EFFECTIVE
        assert client.get(base + "/versions").json() == []
        version = client.post(base + "/versions", json={"candidate_id": candidate["id"], "name": "Morning melody"})
        assert version.status_code == 201, version.text
        assert version.json()["inputs"] == selected
        assert version.json()["parent_version_id"] is None
        assert client.get(base + "/assets/" + saved["abc_asset_id"] + "/content").text == SELECTED


def test_version_audio_becomes_actual_first_sixteen_seconds_reference_with_inherited_parent(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path, runtime_mode="fake")
    indices = np.arange(1679936)
    # A time-varying, distinct L/R source distinguishes wrong segments/channels.
    left = ((indices % 16001) - 8000 + (indices // 48000) * 100).astype(np.int16)
    right = (12000 - (indices % 15013) - (indices // 48000) * 50).astype(np.int16)
    original_pcm = np.column_stack([left, right]).astype("<i2").tobytes()
    encoded = BytesIO()
    with av.open(encoded, mode="w", format="flac") as container:
        stream = container.add_stream("flac", rate=48000)
        assert isinstance(stream, AudioStream)
        stream.layout = "stereo"
        stream.codec_context.format = "s16"
        for offset in range(0, len(indices), 4096):
            values = np.column_stack([left[offset:offset + 4096], right[offset:offset + 4096]]).reshape(1, -1)
            frame = av.AudioFrame.from_ndarray(values, format="s16", layout="stereo")
            frame.sample_rate = 48000
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)
    result = generation_fixture()
    result = replace(result, artifacts=tuple(RuntimeArtifact("audio", encoded.getvalue(), "flac", "audio/flac", "original.flac") if item.role == "audio" else item for item in result.artifacts))
    runtime = FakeInferenceRuntime(result_factories={"Generate": lambda: result})
    with TestClient(create_app(settings, runtime=runtime)) as client:
        project = client.post("/projects", json={"name": "Morning cover"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        source_audio = client.get(base + "/assets/" + original["audio_asset_id"] + "/content").content
        source_asset = client.get(base + "/assets/" + original["audio_asset_id"]).json()
        intent = {"source_version_id": original["id"], "save_id": str(uuid4())}
        created = client.post(base + "/reference-audio/from-version", json=intent)
        assert created.status_code == 201, created.text
        reference = created.json()
        assert reference["id"] == intent["save_id"]
        assert (reference["kind"], reference["format"], reference["duration_seconds"], reference["sample_rate"], reference["channels"], reference["sample_width_bits"]) == ("reference_audio", "wav", 16, 48000, 2, 16)
        origin = client.get(base + "/assets/" + reference["id"] + "/reference-origin").json()
        assert origin == {"reference_asset_id": reference["id"], "source_version_id": original["id"], "source_asset_id": original["audio_asset_id"],
                          "source_sha256": source_asset["sha256"], "start_frame": 0, "frame_count": 768000, "sample_rate": 48000, "derivation_version": "1.0.0"}
        derived = client.get(base + "/assets/" + reference["id"] + "/content").content
        with wave.open(BytesIO(derived), "rb") as reader:
            assert (reader.getnframes(), reader.getframerate(), reader.getnchannels(), reader.getsampwidth()) == (768000, 48000, 2, 2)
            pcm = reader.readframes(768000)
        assert pcm == original_pcm[:768000 * 4]
        assert hashlib.sha256(derived).hexdigest() == reference["sha256"]
        assert client.post(base + "/reference-audio/from-version", json=intent).status_code == 200
        assert client.get(base + "/versions").json() == [original]
        transcribed = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
        completed = wait_job(client, project["id"], transcribed["id"])
        assert completed["status"] == "completed", completed
        score = client.get(base + "/scores/" + completed["result"]["score_id"]).json()
        assert score["source_reference_asset_id"] == reference["id"]
        assert score["parent_version_id"] == original["id"]
        abc = client.get(base + "/assets/" + score["abc_asset_id"] + "/content").text
        edited = client.post(base + "/scores", json={"abc": abc.replace("D4", "E4"), "source_score_id": score["id"]})
        assert edited.status_code == 201, edited.text
        assert edited.json()["parent_version_id"] == original["id"]
    with TestClient(create_app(settings)) as client:
        assert client.get(base + "/assets/" + reference["id"] + "/reference-origin").json() == origin
        assert client.get(base + "/assets/" + reference["id"] + "/content").content == derived
        assert client.get(base + "/scores/" + edited.json()["id"]).json() == edited.json()
        assert client.get(base + "/versions/" + original["id"]).json() == original
        assert client.get(base + "/assets/" + original["audio_asset_id"] + "/content").content == source_audio


class MissingMelody(FakeInferenceRuntime):
    def __init__(self):
        super().__init__(result_factories={"Generate": generation_fixture, "GenerateFromScore": generation_fixture, "Cover": generation_fixture})

    def health(self):
        return replace(super().health(), node_enum_choices={"YuE2Options": {"cot": ("full", "off")}})


def selected_inputs(reference, saved):
    return dict(INPUTS, abc=SELECTED, source_score_id=saved["id"], reference_asset_id=reference["id"], mode="melody", max_seconds=35,
                parent_version_id=None, effective_abc_sha256=hashlib.sha256(EFFECTIVE.encode()).hexdigest(), mode_transform_version="1.0.0")


def test_missing_melody_enum_with_existing_nodes_does_not_create_work_or_disable_existing_full_gfs(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path), runtime=MissingMelody())) as client:
        project = client.post("/projects", json={"name": "Morning cover"}).json()
        base = "/projects/" + project["id"]
        reference, saved, _ = cover_selection(client, base)
        capabilities = {item["operation"]: item for item in client.get("/runtime/capabilities").json()["capabilities"]}
        assert capabilities["Cover"]["ready"] is False
        assert capabilities["Cover"]["supported_modes"] == []
        assert capabilities["GenerateFromScore"]["ready"] is True
        prior = client.get(base + "/jobs").json()
        refused = client.post(base + "/jobs/cover", json=selected_inputs(reference, saved))
        assert refused.status_code == 503 and refused.json()["error"]["code"] == "capability_missing"
        assert client.get(base + "/jobs").json() == prior
        unchanged = client.post(base + "/jobs/generate-from-score", json=dict(INPUTS, abc=SELECTED, source_score_id=saved["id"]))
        assert unchanged.status_code == 202, unchanged.text
        completed = wait_job(client, project["id"], unchanged.json()["id"])
        assert completed["status"] == "completed", completed
        assert completed["provenance"]["settings"]["cot"] == "full"
        assert client.get(base + "/assets/" + completed["result"]["abc_asset_id"] + "/content").text == SELECTED


@pytest.mark.parametrize("case,status,code", [("reference",409,"cover_source_mismatch"), ("standalone",409,"cover_source_mismatch"),
    ("abc",409,"cover_selection_mismatch"), ("hash",409,"cover_selection_mismatch"), ("parent",409,"source_parent_mismatch"),
    ("full",422,"invalid_request"), ("foreign",404,"score_not_found")])
def test_cover_rejects_false_source_or_unreviewed_input_before_a_job_exists(tmp_path: Path, case, status, code) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name": "Morning cover"}).json()
        base = "/projects/" + project["id"]
        reference, saved, _ = cover_selection(client, base)
        value = selected_inputs(reference, saved)
        if case == "reference":
            second = client.post(base + "/assets", files={"file": ("another.wav", reference_audio())}).json()
            value["reference_asset_id"] = second["id"]
        elif case == "standalone":
            value["source_score_id"] = client.post(base + "/scores", json={"abc": SELECTED}).json()["id"]
        elif case == "abc":
            value["abc"] = SELECTED.replace("D4", "F4")
        elif case == "hash":
            value["effective_abc_sha256"] = "0" * 64
        elif case == "parent":
            value["parent_version_id"] = source_version(client, base)["id"]
        elif case == "full":
            value["mode"] = "full"
        else:
            other = client.post("/projects", json={"name": "Other"}).json()
            value["source_score_id"] = client.post("/projects/" + other["id"] + "/scores", json={"abc": SELECTED}).json()["id"]
        before = client.get(base + "/jobs").json()
        response = client.post(base + "/jobs/cover", json=value)
        assert response.status_code == status, response.text
        assert response.json()["error"]["code"] == code
        assert client.get(base + "/jobs").json() == before
        assert client.get(base + "/assets/" + saved["abc_asset_id"] + "/content").text == SELECTED


def test_version_reference_rejects_arbitrary_parent_and_foreign_version_without_writing_assets(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name": "Morning cover"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        before = client.get(base + "/assets").json()
        invalid = client.post(base + "/reference-audio/from-version", json={"source_version_id": original["id"], "parent_version_id": original["id"]})
        assert invalid.status_code == 422
        other = client.post("/projects", json={"name": "Other"}).json()
        foreign = source_version(client, "/projects/" + other["id"])
        denied = client.post(base + "/reference-audio/from-version", json={"source_version_id": foreign["id"]})
        assert denied.status_code == 404
        assert client.get(base + "/assets").json() == before


@pytest.mark.parametrize("after_commit", [False, True])
def test_reference_save_failure_or_lost_ack_can_recover_the_same_frozen_intent(tmp_path: Path, after_commit: bool) -> None:
    armed = {"value": True}

    def fault(session):
        sources = list(session.identity_map.values()) if after_commit else list(session.new)
        if armed["value"] and any(isinstance(item, ReferenceOrigin) for item in sources):
            armed["value"] = False
            raise SQLAlchemyError("External Reference origin provider acknowledgement fault")

    boundary = "after_commit" if after_commit else "before_commit"
    event.listen(Session, boundary, fault)
    try:
        with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
            project = client.post("/projects", json={"name": "Morning cover"}).json()
            base = "/projects/" + project["id"]
            original = source_version(client, base)
            before = client.get(base + "/assets").json()
            intent = {"source_version_id": original["id"], "save_id": str(uuid4())}
            failed = client.post(base + "/reference-audio/from-version", json=intent)
            assert armed["value"] is False
            assert failed.status_code == 503
            assert failed.json()["error"]["code"] == ("reference_commit_unconfirmed" if after_commit else "reference_save_failed")
            assert failed.json()["error"]["resource_id"] == intent["save_id"]
            readback = client.get(base + "/assets/" + intent["save_id"])
            assert readback.status_code == (200 if after_commit else 404)
            if not after_commit:
                assert client.get(base + "/assets").json() == before
            retry = client.post(base + "/reference-audio/from-version", json=intent)
            assert retry.status_code == (200 if after_commit else 201), retry.text
            assert retry.json()["id"] == intent["save_id"]
            assert len(client.get(base + "/assets").json()) == len(before) + 1
            assert client.get(base + "/versions").json() == [original]
    finally:
        event.remove(Session, boundary, fault)


class CoverFaults(FakeInferenceRuntime):
    def __init__(self, case):
        super().__init__(result_factories={"Cover": generation_fixture})
        self.case = case
        self.release = threading.Event()

    def status(self, handle):
        state = super().status(handle)
        if self._requests[handle][0].operation == "Cover" and state.state != "cancelled" and self.case == "hold" and not self.release.is_set():
            return RuntimeStatus("running", "generating_semantic", None)
        return state

    def result(self, handle, operation):
        result = super().result(handle, operation)
        if operation == "Cover" and self.case == "wrong_score":
            return replace(result, artifacts=tuple(replace(item, data=item.data + b"\n% wrong output") if item.role == "abc" else item for item in result.artifacts))
        if operation == "Cover" and self.case == "source_metadata":
            return replace(result, provenance={"settings": {"cot": "full"}, "selected_score": {"mode": "full"}, "cover_source": {"reference_asset_id": "foreign"}})
        return result


@pytest.mark.parametrize("case", ["wrong_score", "source_metadata"])
def test_cover_import_cannot_replace_frozen_music_mode_or_source(tmp_path: Path, case) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path), runtime=CoverFaults(case))) as client:
        project = client.post("/projects", json={"name": "Morning cover"}).json()
        base = "/projects/" + project["id"]
        reference, saved, transcribed = cover_selection(client, base)
        before = client.get(base + "/assets").json()
        submitted = client.post(base + "/jobs/cover", json=selected_inputs(reference, saved))
        assert submitted.status_code == 202
        job = wait_job(client, project["id"], submitted.json()["id"])
        if case == "wrong_score":
            assert job["status"] == "failed" and job["error"]["code"] == "score_result_mismatch"
            assert client.get(base + "/candidates").json() == []
            assert client.get(base + "/assets").json() == before
        else:
            assert job["status"] == "completed", job
            candidate = client.get(base + "/candidates/" + job["result"]["candidate_id"]).json()
            assert candidate["provenance"]["settings"]["cot"] == "melody"
            assert candidate["provenance"]["selected_score"]["mode"] == "melody"
            assert candidate["provenance"]["cover_source"]["reference_asset_id"] == reference["id"]
            assert candidate["provenance"]["cover_source"]["transcribe_job_id"] == transcribed["id"]
        assert client.get(base + "/assets/" + saved["abc_asset_id"] + "/content").text == SELECTED


def test_cancel_and_explicit_retry_keep_original_cover_input_without_retranscribing(tmp_path: Path) -> None:
    runtime = CoverFaults("hold")
    with TestClient(create_app(Settings(data_dir=tmp_path), runtime=runtime)) as client:
        project = client.post("/projects", json={"name": "Morning cover"}).json()
        base = "/projects/" + project["id"]
        reference, saved, transcribed = cover_selection(client, base)
        selected = selected_inputs(reference, saved)
        first = client.post(base + "/jobs/cover", json=selected).json()
        second = client.post(base + "/jobs/cover", json=dict(selected, seed=2026440002)).json()
        cancelled_queued = client.post(base + "/jobs/" + second["id"] + "/cancel").json()
        cancelled_running = client.post(base + "/jobs/" + first["id"] + "/cancel").json()
        assert cancelled_queued["status"] == cancelled_running["status"] == "cancelled"
        assert client.get(base + "/candidates").json() == []
        assert client.get(base + "/scores/" + saved["id"]).json() == saved
        runtime.release.set()
        retry = client.post(base + "/jobs/" + first["id"] + "/retry")
        assert retry.status_code == 202
        assert retry.json()["id"] != first["id"]
        assert retry.json()["inputs"] == selected
        done = wait_job(client, project["id"], retry.json()["id"])
        assert done["status"] == "completed", done
        assert done["provenance"]["retry_of_job_id"] == first["id"]
        jobs = client.get(base + "/jobs").json()
        assert [job["id"] for job in jobs if job["operation"] == "Transcribe"] == [transcribed["id"]]
        assert client.get(base + "/jobs/" + first["id"]).json() == cancelled_running
        assert client.get(base + "/versions").json() == []
