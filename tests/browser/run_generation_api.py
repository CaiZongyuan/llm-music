"""Owned CPU Runtime faults, through the unchanged production HTTP application."""

from dataclasses import replace
import json
import os
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True

from sqlalchemy import event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import run_api
from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.runtime_types import RuntimeStatus
from music_api.version_models import Version


def control() -> dict:
    path = Path(os.environ["MUSIC_BROWSER_RUN_DIR"]) / "generation-control.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


class ControlledRuntime(FakeInferenceRuntime):
    def __init__(self):
        super().__init__(result_factories={"Generate": generation_fixture, "GenerateFromScore": generation_fixture})
        self.scenarios = {}

    def capabilities(self, observation=None):
        values = super().capabilities(observation)
        if control().get("capability") == "missing":
            return tuple(replace(value, ready=False, reasons=("model_missing",)) if value.operation in {"Generate", "GenerateFromScore"} else value for value in values)
        return values

    def submit(self, request):
        receipt = super().submit(request)
        if receipt.handle:
            self.scenarios[receipt.handle] = control().get("scenario", "complete")
        return receipt

    def status(self, handle):
        if handle in self._cancelled:
            return RuntimeStatus("cancelled", code="cancelled", message="Owned CPU Job cancelled")
        scenario = self.scenarios.get(handle, "complete")
        began = self._requests[handle][1]
        if time.monotonic() - began < 0.8 or scenario == "hold":
            return RuntimeStatus("running", "synthesizing", progress=None)
        if scenario in {"runtime_out_of_memory", "model_missing", "workflow_invalid", "generation_failed"}:
            return RuntimeStatus("failed", code=scenario, message="Owned CPU Runtime failure scenario")
        return RuntimeStatus("completed")


def fail_save(session):
    marker = Path(os.environ["MUSIC_BROWSER_RUN_DIR"]) / "fail-version-save"
    if marker.exists() and any(isinstance(value, Version) for value in session.identity_map.values()):
        marker.unlink()
        raise SQLAlchemyError("Owned Version persistence failure before commit")


def lose_acknowledgement(session):
    marker = Path(os.environ["MUSIC_BROWSER_RUN_DIR"]) / "lose-version-ack"
    if marker.exists() and any(isinstance(value, Version) for value in session.identity_map.values()):
        marker.unlink()
        raise RuntimeError("Owned lost Version acknowledgement after durable commit")


if __name__ == "__main__":
    original_create_app = run_api.create_app
    run_api.create_app = lambda settings: original_create_app(settings, runtime=ControlledRuntime())
    event.listen(Session, "before_commit", fail_save)
    event.listen(Session, "after_commit", lose_acknowledgement)
    try:
        run_api.main()
    finally:
        event.remove(Session, "before_commit", fail_save)
        event.remove(Session, "after_commit", lose_acknowledgement)
