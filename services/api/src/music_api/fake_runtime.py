"""Identified CPU fixtures satisfy the Runtime seam without loading any model."""

from datetime import datetime, timezone
from dataclasses import replace
from pathlib import Path
import struct
import time
from typing import Callable, Mapping
from uuid import uuid4

from music_api.readiness import evaluate_readiness
from music_api.runtime_types import (OPERATIONS, CapabilityObservation, Operation, RuntimeArtifact, RuntimeMode, RuntimeObservation,
                                     RuntimeRequest, RuntimeResult, RuntimeStatus, SubmissionReceipt)
from music_api.workflow_registry import WorkflowRegistry


ABC = b"X:1\nM:4/4\nL:1/4\nK:C\nC D E F |\n"
MIDI_EVENTS = b"\x00\xff\x51\x03\x07\xa1\x20" + b"".join(b"\x00\x90" + bytes([pitch, 64]) + b"\x83\x60\x80" + bytes([pitch, 0]) for pitch in [60, 62, 64, 65]) + b"\x00\xff\x2f\x00"
MIDI = b"MThd" + struct.pack(">IHHH", 6, 0, 1, 480) + b"MTrk" + struct.pack(">I", len(MIDI_EVENTS)) + MIDI_EVENTS


class FakeInferenceRuntime:
    mode: RuntimeMode = "fake"

    def __init__(self, results: Mapping[Operation, RuntimeResult] | None = None, registry: WorkflowRegistry | None = None,
                 output_dir: Path | None = None, result_factories: Mapping[Operation, Callable[[], RuntimeResult]] | None = None) -> None:
        self.registry = registry or WorkflowRegistry()
        self.output_dir = output_dir
        self.result_factories = dict(result_factories or {})
        self.results: dict[Operation, RuntimeResult] = dict(results) if results is not None else {"Transcribe": RuntimeResult(
            (RuntimeArtifact("abc", ABC, "abc", "text/vnd.abc", "score.abc"), RuntimeArtifact("midi", MIDI, "mid", "audio/midi", "score.mid")),
            provenance={"runtime_kind": "fake", "validation_scope": "legal CPU fixture; no model inference"},
            score_validation={"valid": True, "note_count": 4, "duration_seconds": 2})}
        self._requests: dict[str, tuple[RuntimeRequest, float]] = {}

    def health(self) -> RuntimeObservation:
        nodes = frozenset(node for operation in self.results.keys() | self.result_factories.keys() for node in self.registry.workflow(operation).required_nodes)
        return RuntimeObservation("fake", "Identified CPU Runtime fixtures", datetime.now(timezone.utc), True, registered_nodes=nodes)

    def capabilities(self, observation: RuntimeObservation | None = None) -> tuple[CapabilityObservation, ...]:
        value = observation or self.health()
        return tuple(evaluate_readiness(value, self.registry.requirements(), self.registry.workflow(operation), now=datetime.now(timezone.utc), max_age_seconds=300)
                     for operation in OPERATIONS)

    def submit(self, request: RuntimeRequest) -> SubmissionReceipt:
        capability = next(item for item in self.capabilities() if item.operation == request.operation)
        if not capability.ready:
            return SubmissionReceipt("rejected", code="capability_missing", message="The requested fake fixture is unavailable.")
        handle = str(uuid4())
        if request.operation in self.result_factories:
            self.results[request.operation] = self.result_factories[request.operation]()
        self._requests[handle] = (request, time.monotonic())
        if self.output_dir is not None:
            folder = self.output_dir / handle
            folder.mkdir(parents=True)
            for artifact in self.results[request.operation].artifacts:
                (folder / (artifact.role + "." + artifact.format)).write_bytes(artifact.data)
        return SubmissionReceipt("accepted", handle)

    def status(self, handle: str) -> RuntimeStatus:
        request, began = self._requests[handle]
        if time.monotonic() - began < 0.02:
            return RuntimeStatus("queued")
        if time.monotonic() - began < 0.05:
            return RuntimeStatus("running", "transcribing" if request.operation == "Transcribe" else "synthesizing")
        return RuntimeStatus("completed")

    def recover(self, request: RuntimeRequest) -> SubmissionReceipt:
        matches = [handle for handle, (previous, _) in self._requests.items() if previous.attempt_id == request.attempt_id]
        return SubmissionReceipt("accepted", matches[0]) if len(matches) == 1 else SubmissionReceipt("unconfirmed", code="submission_unconfirmed")

    def result(self, handle: str, operation: Operation) -> RuntimeResult:
        if self._requests[handle][0].operation != operation:
            raise ValueError("Fixture result does not match its operation")
        result = self.results[operation]
        if self.output_dir is None:
            return result
        artifacts = tuple(replace(artifact, data=(self.output_dir / handle / (artifact.role + "." + artifact.format)).read_bytes()) for artifact in result.artifacts)
        return replace(result, artifacts=artifacts)
