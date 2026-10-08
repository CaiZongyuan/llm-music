"""Owned CPU Cover fixtures and faults through the unchanged public application."""

from dataclasses import replace
import json
import os
from pathlib import Path
import struct
import time

from sqlalchemy import event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import run_api
from run_generation_api import fail_save, lose_acknowledgement
from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.job_models import Job
from music_api.reference_audio import ReferenceOrigin
from music_api.runtime_types import RuntimeArtifact, RuntimeResult, RuntimeStatus


ABC = ('X:1\nT:\nM:4/4\nL:1/8\nQ:1/4=96\n'
       'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"\n'
       'V: Ins clef=treble name="Ins Melody" snm="Inst."\nK:C\n% verse\nV: Vocal\n'
       '"C"z8 | "Am"z8 | "F"z8 | "G"z8 |\nV: Ins\n'
       'C D E F G2 E2 | F E D C D4 | E F G A G2 E2 | D E F D C4 |')


def variable(value):
    result = bytearray([value & 127])
    while value > 127:
        value >>= 7
        result.insert(0, 128 | (value & 127))
    return bytes(result)


def transcription_fixture():
    pitches = [60, 62, 64, 65, 67, 64, 65, 64, 62, 60, 62, 64, 65, 67, 69, 67, 64, 62, 64, 65, 62, 60]
    durations = [240, 240, 240, 240, 480, 480, 240, 240, 240, 240, 960, 240, 240, 240, 240, 480, 480, 240, 240, 240, 240, 960]
    track = b"\x00\xff\x51\x03\x09\x89\x68"
    for pitch, duration in zip(pitches, durations):
        track += b"\x00\x90" + bytes([pitch, 64]) + variable(duration) + b"\x80" + bytes([pitch, 0])
    track += b"\x00\xff\x2f\x00"
    midi = b"MThd" + struct.pack(">IHHH", 6, 0, 1, 480) + b"MTrk" + struct.pack(">I", len(track)) + track
    return RuntimeResult((RuntimeArtifact("abc", ABC.encode(), "abc", "text/vnd.abc", "score.abc"), RuntimeArtifact("midi", midi, "mid", "audio/midi", "score.mid")),
                         provenance={"runtime_kind": "fake", "validation_scope": "Independent chorded rest-only Vocal CPU fixture, no inference"},
                         score_validation={"valid": True, "note_count": 22})


def control():
    path = Path(os.environ["MUSIC_BROWSER_RUN_DIR"]) / "cover-control.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


class ControlledCoverRuntime(FakeInferenceRuntime):
    def __init__(self):
        super().__init__(result_factories={"Generate": generation_fixture, "GenerateFromScore": generation_fixture,
                                           "Transcribe": transcription_fixture, "Cover": generation_fixture})
        self.scenarios = {}

    def health(self):
        observed = super().health()
        if control().get("capability") == "remove_melody_enum":
            return replace(observed, node_enum_choices={"YuE2Options": {"cot": ("full", "off")}})
        return observed

    def capabilities(self, observation=None):
        values = super().capabilities(observation)
        if control().get("capability") == "model_missing":
            return tuple(replace(value, ready=False, reasons=("model_missing",)) if value.operation == "Cover" else value for value in values)
        return values

    def submit(self, request):
        receipt = super().submit(request)
        if receipt.handle:
            key = "transcribe_scenario" if request.operation == "Transcribe" else "scenario" if request.operation == "Cover" else "unused"
            self.scenarios[receipt.handle] = control().get(key, "complete")
        return receipt

    def status(self, handle):
        if handle in self._cancelled:
            return RuntimeStatus("cancelled", code="cancelled")
        scenario = self.scenarios.get(handle, "complete")
        request, began = self._requests[handle]
        if scenario == "hold" or time.monotonic() - began < .8:
            return RuntimeStatus("running", "transcribing" if request.operation == "Transcribe" else "synthesizing", None)
        if scenario in {"runtime_out_of_memory", "generation_failed", "transcription_failed"}:
            return RuntimeStatus("failed", code=scenario)
        return RuntimeStatus("completed")

    def result(self, handle, operation):
        result = super().result(handle, operation)
        scenario = self.scenarios.get(handle)
        if operation == "Cover" and scenario == "wrong_score":
            return replace(result, artifacts=tuple(replace(item, data=item.data + b"\n% external wrong result") if item.role == "abc" else item for item in result.artifacts))
        if operation == "Cover" and scenario == "source_metadata":
            return replace(result, provenance={"settings": {"cot": "full"}, "selected_score": {"mode": "full", "effective_abc": "wrong"}, "cover_source": {"reference_asset_id": "wrong"}})
        return result


def fail_import(session):
    if control().get("scenario") == "import_failure" and any(isinstance(item, Job) and item.operation == "Cover" and item.status == "completed" for item in session.identity_map.values()):
        raise SQLAlchemyError("Owned external result metadata provider failed before commit")


def fail_reference_save(session):
    marker = Path(os.environ["MUSIC_BROWSER_RUN_DIR"]) / "fail-reference-save"
    if marker.exists() and any(isinstance(item, ReferenceOrigin) for item in session.new):
        marker.unlink()
        raise SQLAlchemyError("Owned Reference origin provider failed before commit")


def lose_reference_ack(session):
    marker = Path(os.environ["MUSIC_BROWSER_RUN_DIR"]) / "lose-reference-ack"
    if marker.exists() and any(isinstance(item, ReferenceOrigin) for item in session.identity_map.values()):
        marker.unlink()
        raise RuntimeError("Owned Reference acknowledgement lost after durable commit")


if __name__ == "__main__":
    original_create_app = run_api.create_app
    run_api.create_app = lambda settings: original_create_app(settings, runtime=ControlledCoverRuntime())
    event.listen(Session, "before_commit", fail_save)
    event.listen(Session, "after_commit", lose_acknowledgement)
    event.listen(Session, "before_commit", fail_import)
    event.listen(Session, "before_commit", fail_reference_save)
    event.listen(Session, "after_commit", lose_reference_ack)
    try:
        run_api.main()
    finally:
        event.remove(Session, "before_commit", fail_save)
        event.remove(Session, "after_commit", lose_acknowledgement)
        event.remove(Session, "before_commit", fail_import)
        event.remove(Session, "before_commit", fail_reference_save)
        event.remove(Session, "after_commit", lose_reference_ack)
