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


ABC = (b'X:1\nT:\nM:4/4\nL:1/16\nQ:1/4=120\n'
       b'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"\n'
       b'V: Ins clef=treble name="Ins Melody" snm="Inst."\n'
       b'K:C\n% verse\nV: Vocal\nC4 D4 E4 F4 |\nV: Ins\nZ |\n')
MIDI_EVENTS = b"\x00\xff\x51\x03\x07\xa1\x20" + b"".join(b"\x00\x90" + bytes([pitch, 64]) + b"\x83\x60\x80" + bytes([pitch, 0]) for pitch in [60, 62, 64, 65]) + b"\x00\xff\x2f\x00"
MIDI = b"MThd" + struct.pack(">IHHH", 6, 0, 1, 480) + b"MTrk" + struct.pack(">I", len(MIDI_EVENTS)) + MIDI_EVENTS


class FakeInferenceRuntime:
    mode: RuntimeMode = "fake"

    def __init__(self, results: Mapping[Operation, RuntimeResult] | None = None, registry: WorkflowRegistry | None = None,
                 output_dir: Path | None = None, result_factories: Mapping[Operation, Callable[[dict[str, object]], RuntimeResult]] | None = None,
                 max_age_seconds: float = 300) -> None:
        self.registry = registry or WorkflowRegistry()
        self.output_dir = output_dir
        self.result_factories = dict(result_factories or {})
        self.max_age_seconds = max_age_seconds
        self.results: dict[Operation, RuntimeResult] = dict(results) if results is not None else {"Transcribe": RuntimeResult(
            (RuntimeArtifact("abc", ABC, "abc", "text/vnd.abc", "score.abc"), RuntimeArtifact("midi", MIDI, "mid", "audio/midi", "score.mid")),
            provenance={"runtime_kind": "fake", "validation_scope": "legal CPU fixture; no model inference"},
            score_validation={"valid": True, "note_count": 4, "duration_seconds": 2})}
        self._requests: dict[str, tuple[RuntimeRequest, float]] = {}
        self._results: dict[str, RuntimeResult] = {}
        self._cancelled: set[str] = set()

    def health(self) -> RuntimeObservation:
        nodes = frozenset(node for operation in self.results.keys() | self.result_factories.keys() for node in self.registry.workflow(operation).required_nodes)
        return RuntimeObservation("fake", "Identified CPU Runtime fixtures", datetime.now(timezone.utc), True, registered_nodes=nodes,
                                  node_inputs={"YuE2GenerateSong": {"score_abc": "STRING"}} if {"GenerateFromScore", "Cover"} & (self.results.keys() | self.result_factories.keys()) else {},
                                  node_enum_choices={"YuE2Options": {"cot": ("full", "melody", "off")}})

    def capabilities(self, observation: RuntimeObservation | None = None) -> tuple[CapabilityObservation, ...]:
        value = observation or self.health()
        capabilities = tuple(evaluate_readiness(value, self.registry.requirements(), self.registry.workflow(operation), now=datetime.now(timezone.utc), max_age_seconds=self.max_age_seconds)
                             for operation in OPERATIONS)
        return tuple(item if item.operation in self.results.keys() | self.result_factories.keys() else
                     replace(item, ready=False, supported_modes=(), reasons=tuple(dict.fromkeys((*item.reasons, "capability_missing")))) for item in capabilities)

    def submit(self, request: RuntimeRequest) -> SubmissionReceipt:
        capability = next(item for item in self.capabilities() if item.operation == request.operation)
        if not capability.ready:
            return SubmissionReceipt("rejected", code="capability_missing", message="The requested fake fixture is unavailable.")
        if request.operation == "Cover" and request.inputs.get("mode") not in capability.supported_modes:
            return SubmissionReceipt("rejected", code="capability_missing", message="Selected fake Cover mode is unavailable.")
        handle = str(uuid4())
        if request.operation in self.result_factories:
            self.results[request.operation] = self.result_factories[request.operation](dict(request.inputs))
        result = self.results[request.operation]
        if request.operation == "GenerateFromScore":
            from music_api.score_input import effective_score_abc, selected_score_validation
            abc = effective_score_abc(str(request.inputs["abc"]))[0]
            result = replace(result, artifacts=tuple(replace(artifact, data=abc.encode("utf-8")) if artifact.role == "abc" else artifact
                                                     for artifact in result.artifacts), score_validation=selected_score_validation(abc))
        if request.operation == "Cover":
            from music_api.cover import cover_score_validation
            checked = cover_score_validation(str(request.inputs["abc"]), str(request.inputs["mode"]))
            result = replace(result, artifacts=tuple(replace(artifact, data=str(checked["effective_abc"]).encode("utf-8")) if artifact.role == "abc" else artifact
                                                     for artifact in result.artifacts), score_validation=checked)
        self._results[handle] = result
        self._requests[handle] = (request, time.monotonic())
        if self.output_dir is not None:
            folder = self.output_dir / handle
            folder.mkdir(parents=True)
            for artifact in result.artifacts:
                (folder / (artifact.role + "." + artifact.format)).write_bytes(artifact.data)
        return SubmissionReceipt("accepted", handle)

    def status(self, handle: str) -> RuntimeStatus:
        if handle in self._cancelled:
            return RuntimeStatus("cancelled", code="cancelled", message="The requested fake Job was cancelled.")
        request, began = self._requests[handle]
        if time.monotonic() - began < 0.02:
            return RuntimeStatus("queued")
        if time.monotonic() - began < 0.05:
            return RuntimeStatus("running", "transcribing" if request.operation == "Transcribe" else "synthesizing")
        return RuntimeStatus("completed")

    def observe(self,handle: str,budget_seconds: float) -> RuntimeStatus:
        return self.status(handle)

    def cancel(self, handle: str) -> RuntimeStatus:
        current = self.status(handle)
        if current.state in {"queued", "running"}:
            self._cancelled.add(handle)
            return self.status(handle)
        return current

    def recover(self, request: RuntimeRequest) -> SubmissionReceipt:
        from music_api.runtime_proof import validate

        try:
            original = validate(request,self.mode,"fake-fixture-v1")
        except ValueError:
            return SubmissionReceipt("unconfirmed",code="original_proof_unavailable")
        matches = [handle for handle, (previous, _) in self._requests.items() if previous.attempt_id == request.attempt_id]
        if len(matches) != 1 or request.runtime_handle is not None and request.runtime_handle != matches[0]:
            return SubmissionReceipt("unconfirmed",code="original_ownership_unconfirmed")
        handle = matches[0]
        try:
            previous = validate(self._requests[handle][0],self.mode,"fake-fixture-v1")
        except ValueError:
            return SubmissionReceipt("unconfirmed",code="original_ownership_unconfirmed")
        return SubmissionReceipt("accepted",handle,status=self.status(handle)) if original == previous else SubmissionReceipt("unconfirmed",code="original_ownership_unconfirmed")

    def subscribe(self, handle: str, operation: Operation, on_status: Callable[[RuntimeStatus], None]) -> Callable[[], None]:
        from music_api.fake_events import subscribe_fake

        if self._requests[handle][0].operation != operation:
            raise ValueError("Subscription operation differs from the fixture request")
        return subscribe_fake(lambda: self.status(handle), on_status)

    def result(self, handle: str, operation: Operation) -> RuntimeResult:
        if self._requests[handle][0].operation != operation:
            raise ValueError("Fixture result does not match its operation")
        result = self._results.get(handle, self.results[operation])
        if self.output_dir is None:
            return result
        artifacts = tuple(replace(artifact, data=(self.output_dir / handle / (artifact.role + "." + artifact.format)).read_bytes()) for artifact in result.artifacts)
        return replace(result, artifacts=artifacts)
    def prepare(self, request: RuntimeRequest) -> dict[str, object]:
        from music_api.runtime_proof import freeze
        workflow = self.registry.workflow(request.operation)
        return freeze(request,self.mode,"fake-fixture-v1",workflow,workflow.graph)
