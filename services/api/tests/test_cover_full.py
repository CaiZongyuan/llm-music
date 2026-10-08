"""Full Cover keeps inspected written harmony through the public creator path."""

import hashlib
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from test_cover import EFFECTIVE, SELECTED, cover_selection, selected_inputs
from test_generate_from_score import source_version
from test_generation_versions import INPUTS, wait_job


def test_full_cover_retains_written_chords_and_true_parent_until_explicit_save(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"))) as client:
        project = client.post("/projects", json={"name": "Morning full Cover"}).json()
        base = "/projects/" + project["id"]
        parent = source_version(client, base)
        original = client.get(base + "/assets/" + parent["audio_asset_id"] + "/content").content
        reference = client.post(base + "/reference-audio/from-version", json={"source_version_id": parent["id"]}).json()
        transcription = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
        transcribed = wait_job(client, project["id"], transcription["id"])
        saved = client.post(base + "/scores", json={"abc": SELECTED, "source_score_id": transcribed["result"]["score_id"]}).json()
        checked = client.post(base + "/cover-inputs/validate", json={"abc": SELECTED, "mode": "full"})
        assert checked.status_code == 200, checked.text
        assert checked.json()["effective_abc"] == SELECTED
        assert checked.json()["source_chord_count"] == 1
        assert checked.json()["warnings"] == []
        inputs = dict(INPUTS, abc=SELECTED, source_score_id=saved["id"], parent_version_id=parent["id"],
                      reference_asset_id=reference["id"], mode="full", mode_transform_version="1.0.0", max_seconds=35,
                      effective_abc_sha256=hashlib.sha256(SELECTED.encode()).hexdigest())
        submitted = client.post(base + "/jobs/cover", json=inputs)
        assert submitted.status_code == 202, submitted.text
        completed = wait_job(client, project["id"], submitted.json()["id"])
        assert completed["status"] == "completed", completed
        assert completed["inputs"] == inputs
        assert completed["provenance"]["settings"]["cot"] == "full"
        assert completed["provenance"]["workflow_version"] == "2.0.0"
        assert completed["provenance"]["selected_score"]["effective_abc"] == SELECTED
        assert completed["provenance"]["cover_source"]["transcribe_job_id"] == transcribed["id"]
        candidate = client.get(base + "/candidates/" + completed["result"]["candidate_id"]).json()
        assert candidate["inputs"] == inputs
        assert candidate["provenance"] == completed["provenance"]
        assert client.get(base + "/assets/" + completed["result"]["abc_asset_id"] + "/content").text == SELECTED
        assert client.get(base + "/versions").json() == [parent]
        version = client.post(base + "/versions", json={"candidate_id": candidate["id"], "name": "Full harmony"})
        assert version.status_code == 201, version.text
        assert version.json()["parent_version_id"] == parent["id"]
        assert version.json()["inputs"] == inputs
        assert client.get(base + "/versions/" + parent["id"]).json() == parent
        assert client.get(base + "/assets/" + parent["audio_asset_id"] + "/content").content == original
        assert client.get(base + "/assets/" + saved["abc_asset_id"] + "/content").text == SELECTED


class ObservedModes(FakeInferenceRuntime):
    def __init__(self, choices: tuple[str, ...]):
        super().__init__(result_factories={"Cover": generation_fixture})
        self.choices = choices

    def health(self):
        return replace(super().health(), node_enum_choices={"YuE2Options": {"cot": self.choices}})


@pytest.mark.parametrize("choices,available", [(("full", "off"), ["full"]), (("melody", "off"), ["melody"]), (("off",), [])])
def test_each_observed_cover_mode_is_usable_independently_of_the_other(tmp_path: Path, choices, available) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path), runtime=ObservedModes(choices))) as client:
        project = client.post("/projects", json={"name": "Observed modes"}).json()
        base = "/projects/" + project["id"]
        reference, saved, _ = cover_selection(client, base)
        capability = next(item for item in client.get("/runtime/capabilities").json()["capabilities"] if item["operation"] == "Cover")
        assert capability["ready"] is bool(available)
        assert capability["supported_modes"] == available
        for mode, expected in (("full", SELECTED), ("melody", EFFECTIVE)):
            inputs = dict(selected_inputs(reference, saved), mode=mode, effective_abc_sha256=hashlib.sha256(expected.encode()).hexdigest())
            prior = client.get(base + "/jobs").json()
            response = client.post(base + "/jobs/cover", json=inputs)
            if mode not in available:
                assert response.status_code == 503 and response.json()["error"]["code"] == "capability_missing"
                assert client.get(base + "/jobs").json() == prior
            else:
                assert response.status_code == 202, response.text
                job = wait_job(client, project["id"], response.json()["id"])
                assert job["status"] == "completed", job
                assert job["inputs"]["mode"] == job["provenance"]["settings"]["cot"] == mode
                assert client.get(base + "/assets/" + job["result"]["abc_asset_id"] + "/content").text == expected


REST_FULL = ('X:1\nT:\nM:4/4\nL:1/16\nQ:1/4=96\n'
             'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"\n'
             'V: Ins clef=treble name="Ins Melody" snm="Inst."\n'
             'K:C\n% verse\nV: Vocal\n"C"z16 |\nV: Ins\nC4 D4 E4 G4 |')
REST_NO_CHORDS = ('X:1\nT:\nM:4/4\nL:1/16\nQ:1/4=96\n'
                  'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"\n'
                  'V: Ins clef=treble name="Ins Melody" snm="Inst."\n'
                  'K:C\n% verse\nV: Vocal\nz16 |\nV: Ins\nC4 D4 E4 G4 |')


@pytest.mark.parametrize("abc,chords,warnings", [(REST_FULL, 1, []), (REST_NO_CHORDS, 0, ["full_without_written_chords"])])
def test_full_accepts_rest_only_vocal_and_legal_chordless_input_without_inventing_music(tmp_path: Path, abc, chords, warnings) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name": "Ins carries the notes"}).json()
        base = "/projects/" + project["id"]
        reference, saved, _ = cover_selection(client, base)
        edited = client.post(base + "/scores", json={"abc": abc, "source_score_id": saved["id"]}).json()
        checked = client.post(base + "/cover-inputs/validate", json={"abc": abc, "mode": "full"})
        assert checked.status_code == 200, checked.text
        assert checked.json()["effective_abc"] == abc
        assert checked.json()["note_count"] == 4
        assert checked.json()["source_chord_count"] == chords
        assert checked.json()["warnings"] == warnings
        inputs = dict(selected_inputs(reference, edited), abc=abc, mode="full", effective_abc_sha256=hashlib.sha256(abc.encode()).hexdigest())
        submitted = client.post(base + "/jobs/cover", json=inputs)
        assert submitted.status_code == 202, submitted.text
        job = wait_job(client, project["id"], submitted.json()["id"])
        assert job["status"] == "completed", job
        assert job["inputs"]["mode"] == job["provenance"]["settings"]["cot"] == "full"
        assert job["provenance"]["selected_score"]["warnings"] == warnings
        assert client.get(base + "/assets/" + job["result"]["abc_asset_id"] + "/content").text == abc
        assert client.get(base + "/scores/" + saved["id"]).json() == saved


def test_full_control_marker_adaptation_retains_the_written_harmony(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path))) as client:
        project = client.post("/projects", json={"name": "New words and full harmony"}).json()
        response = client.post("/projects/" + project["id"] + "/cover-inputs/validate",
                               json={"abc": "%yue2-words 0123456789abcdef\n" + SELECTED, "mode": "full"})
        assert response.status_code == 200, response.text
        assert response.json()["effective_abc"] == SELECTED
        assert response.json()["transformations"] == ["remove_native_words_marker"]
        assert response.json()["source_chord_count"] == 1
