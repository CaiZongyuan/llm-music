"""Typed CPU HTTP adapter; all native detail remains inside this module."""

from datetime import datetime, timezone
import json
from typing import cast
from urllib.parse import urlsplit
from urllib.request import urlopen

from music_api.config import Settings
from music_api.readiness import evaluate_readiness
from music_api.runtime_evidence import read_runtime_evidence
from music_api.runtime_types import (OPERATIONS, CapabilityObservation, Operation, RuntimeMode, RuntimeObservation,
                                     RuntimeRequest, RuntimeResult, RuntimeStatus, SubmissionReceipt)
from music_api.workflow_registry import WorkflowRegistry


class ComfyUIRuntime:
    mode: RuntimeMode = "comfyui"

    def __init__(self, settings: Settings, registry: WorkflowRegistry) -> None:
        address = urlsplit(settings.runtime_url)
        if address.scheme != "http" or address.hostname not in {"127.0.0.1", "localhost", "::1"} or address.username or address.password or address.query or address.fragment:
            raise ValueError("Runtime URL must be loopback HTTP without credentials/query/fragment")
        self.settings, self.registry = settings, registry
        self.url = settings.runtime_url.rstrip("/")

    def _read(self, path: str) -> object:
        with urlopen(self.url + path, timeout=self.settings.runtime_timeout_seconds) as response:
            return json.loads(response.read(8 * 1024 * 1024))

    def health(self) -> RuntimeObservation:
        stats: dict[str, object] | None = None
        nodes: frozenset[str] | None = None
        inventory: dict[str, tuple[str, ...]] | None = None
        stats_at, nodes_at, inventory_at = None, None, None
        reasons: list[str] = []
        try:
            raw_stats = self._read("/system_stats")
            if not isinstance(raw_stats, dict):
                raise ValueError("Native system facts are not a JSON object")
            stats = cast(dict[str, object], raw_stats)
            stats_at = datetime.now(timezone.utc)
        except (OSError, ValueError):
            reasons.append("runtime_unavailable")
        try:
            raw_nodes = self._read("/object_info")
            if not isinstance(raw_nodes, dict):
                raise ValueError("Native node facts are not a JSON object")
            nodes = frozenset(cast(dict[str, object], raw_nodes))
            nodes_at = datetime.now(timezone.utc)
        except (OSError, ValueError):
            reasons.append("capability_observation_unavailable")
        try:
            inventory = {}
            for folder in ("checkpoints", "audio_encoders"):
                raw_names = self._read("/models/" + folder)
                if not isinstance(raw_names, list) or not all(isinstance(name, str) for name in raw_names):
                    raise ValueError("Native generic inventory has no filename list")
                inventory[folder] = tuple(cast(list[str], raw_names))
            inventory_at = datetime.now(timezone.utc)
        except (OSError, ValueError):
            inventory = None
        now = datetime.now(timezone.utc)
        attestation = read_runtime_evidence(self.settings.runtime_evidence_path, runtime_url=self.url, now=now,
                                           max_age_seconds=self.settings.diagnostics_max_age_seconds, requirements=self.registry.requirements())
        return RuntimeObservation("comfyui", self.url, now, stats is not None, stats, nodes, inventory,
                                  stats_at, nodes_at, inventory_at, attestation, tuple(reasons))

    def capabilities(self, observation: RuntimeObservation | None = None) -> tuple[CapabilityObservation, ...]:
        value = observation or self.health()
        return tuple(evaluate_readiness(value, self.registry.requirements(), self.registry.workflow(operation), now=datetime.now(timezone.utc),
                                        max_age_seconds=self.settings.diagnostics_max_age_seconds) for operation in OPERATIONS)

    def submit(self, request: RuntimeRequest) -> SubmissionReceipt:
        capability = next(item for item in self.capabilities() if item.operation == request.operation)
        if not capability.ready:
            return SubmissionReceipt("rejected", code=capability.reasons[0], message="Current Runtime readiness is unverified.")
        return SubmissionReceipt("rejected", code="operation_not_implemented", message="Native operation implementation is not yet delivered.")

    def status(self, handle: str) -> RuntimeStatus:
        return RuntimeStatus("unconfirmed", code="operation_not_implemented")

    def recover(self, request: RuntimeRequest) -> SubmissionReceipt:
        return SubmissionReceipt("unconfirmed", code="submission_unconfirmed")

    def result(self, handle: str, operation: Operation) -> RuntimeResult:
        raise RuntimeError("Native result implementation is not yet delivered")
