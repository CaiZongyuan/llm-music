"""Typed CPU HTTP adapter; all native detail remains inside this module."""

from datetime import datetime, timezone
import base64
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
from typing import Literal, cast
from urllib.error import HTTPError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen
import uuid

from music_api.config import Settings
from music_api.readiness import evaluate_readiness
from music_api.runtime_evidence import read_runtime_evidence
from music_api.runtime_types import (OPERATIONS, CapabilityObservation, Operation, RuntimeArtifact, RuntimeMode, RuntimeObservation,
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
        self.requests: dict[str, RuntimeRequest] = {}
        self.graphs: dict[str, dict[str, object]] = {}

    def _read(self, path: str) -> object:
        with urlopen(self.url + path, timeout=self.settings.runtime_timeout_seconds) as response:
            return json.loads(response.read(8 * 1024 * 1024))

    def _post(self, path: str, value: object) -> object:
        request = Request(self.url + path, data=json.dumps(value).encode("utf-8"), headers={"Content-Type": "application/json"})
        with urlopen(request, timeout=self.settings.runtime_timeout_seconds) as response:
            return json.loads(response.read(8 * 1024 * 1024))

    def _upload(self, path: Path, subfolder: str) -> dict[str, object]:
        return self._upload_bytes(path.read_bytes(), path.name, subfolder)

    def _upload_bytes(self, data: bytes, filename: str, subfolder: str) -> dict[str, object]:
        boundary = "music-application-" + uuid.uuid4().hex
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\ninput\r\n'
                f'--{boundary}\r\nContent-Disposition: form-data; name="subfolder"\r\n\r\n{subfolder}\r\n'
                f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{filename}"\r\nContent-Type: application/octet-stream\r\n\r\n').encode() + data + f"\r\n--{boundary}--\r\n".encode()
        request = Request(self.url + "/upload/image", data=body, headers={"Content-Type": "multipart/form-data; boundary=" + boundary})
        with urlopen(request, timeout=self.settings.runtime_timeout_seconds) as response:
            result: object = json.loads(response.read())
        if not isinstance(result, dict) or not isinstance(result.get("name"), str) or result.get("type") != "input":
            raise ValueError("Native upload response is invalid")
        return cast(dict[str, object], result)

    def _history(self, handle: str) -> dict[str, object] | None:
        raw = self._read("/history/" + quote(handle, safe=""))
        if not isinstance(raw, dict):
            raise ValueError("Native history is not a JSON object")
        value = raw.get(handle)
        if value is None:
            return None
        if not isinstance(value, dict):
            raise ValueError("Native history entry is invalid")
        request = self.requests.get(handle)
        prompt = value.get("prompt")
        if request is not None and (not isinstance(prompt, list) or len(prompt) < 4 or prompt[1] != handle or not isinstance(prompt[3], dict) or prompt[3].get("client_id") != str(request.attempt_id)):
            raise ValueError("Native history ownership does not match this attempt")
        if handle in self.graphs and isinstance(prompt, list) and prompt[2] != self.graphs[handle]:
            raise ValueError("Native executed graph differs from the saved request")
        return cast(dict[str, object], value)

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
        workflow = self.registry.workflow(request.operation)
        graph = cast(dict[str, dict[str, object]], deepcopy(dict(workflow.graph)))
        mapping = cast(dict[str, dict[str, object]], workflow.manifest["input_mapping"])
        if request.operation == "Transcribe":
            if request.reference_path is None:
                return SubmissionReceipt("rejected", code="reference_audio_required", message="Original application Reference Audio is unavailable.")
            try:
                uploaded = self._upload(request.reference_path, "application/" + str(request.attempt_id))
            except (OSError, ValueError):
                return SubmissionReceipt("rejected", code="runtime_upload_failed", message="Reference transfer failed before inference submission.")
            binding = mapping["reference_audio"]
            value = "/".join(filter(None, [str(uploaded.get("subfolder", "")), str(uploaded["name"])]))
            cast(dict[str, object], graph[str(binding["node"])]["inputs"])[str(binding["input"])] = value
        else:
            values = dict(request.inputs, max_seconds=35)
            for name, binding in mapping.items():
                cast(dict[str, object], graph[str(binding["node"])]["inputs"])[str(binding["input"])] = values[name]
            outputs = cast(dict[str, dict[str, object]], workflow.manifest["output_mapping"])
            cast(dict[str, object], graph[str(outputs["audio"]["node"])]["inputs"])["filename_prefix"] = "application/" + str(request.attempt_id) + "/audio"
        try:
            reply = self._post("/prompt", dict(prompt=graph, client_id=str(request.attempt_id)))
        except HTTPError as error:
            return SubmissionReceipt("rejected" if 400 <= error.code < 500 else "unconfirmed", code="workflow_invalid" if 400 <= error.code < 500 else "submission_unconfirmed", message="Native submission was rejected." if 400 <= error.code < 500 else "Native acknowledgement failed; work may have been accepted.")
        except (OSError, ValueError):
            return SubmissionReceipt("unconfirmed", code="submission_unconfirmed", message="Native acknowledgement is unavailable; work may have been accepted.")
        if not isinstance(reply, dict) or not isinstance(reply.get("prompt_id"), str) or not reply["prompt_id"] or reply.get("node_errors"):
            return SubmissionReceipt("unconfirmed", code="submission_unconfirmed", message="Native response has no reliable accepted identity.")
        handle = reply["prompt_id"]
        self.requests[handle], self.graphs[handle] = request, cast(dict[str, object], graph)
        return SubmissionReceipt("accepted", handle)

    def status(self, handle: str) -> RuntimeStatus:
        entry = self._history(handle)
        if entry is not None:
            status = entry.get("status")
            if not isinstance(status, dict):
                return RuntimeStatus("unconfirmed", code="runtime_history_invalid")
            if status.get("status_str") == "success" and status.get("completed") is True:
                return RuntimeStatus("completed")
            if status.get("status_str") == "error":
                messages = status.get("messages")
                interrupted = isinstance(messages, list) and any(
                    isinstance(event, list) and len(event) == 2 and event[0] == "execution_interrupted"
                    and isinstance(event[1], dict) and event[1].get("prompt_id") == handle for event in messages)
                if interrupted:
                    normalized = self._read("/api/jobs/" + quote(handle, safe=""))
                    if isinstance(normalized, dict) and normalized.get("id") == handle and normalized.get("status") == "cancelled":
                        return RuntimeStatus("cancelled", code="cancelled", message="The owned Runtime Job was cancelled.")
                return RuntimeStatus("failed", code="runtime_execution_failed", message="Native execution failed; inspect the retained attempt evidence.")
        raw = self._read("/queue")
        if isinstance(raw, dict):
            for key, state in (("queue_running", "running"), ("queue_pending", "queued")):
                rows = raw.get(key)
                if isinstance(rows, list) and any(isinstance(row, list) and len(row) > 1 and row[1] == handle for row in rows):
                    operation = self.requests[handle].operation if handle in self.requests else None
                    return RuntimeStatus(cast(Literal["queued", "running"], state), "transcribing" if state == "running" and operation == "Transcribe" else None)
        return RuntimeStatus("unconfirmed", code="native_status_unconfirmed")

    def cancel(self, handle: str) -> RuntimeStatus:
        request, graph = self.requests.get(handle), self.graphs.get(handle)
        if request is None or graph is None:
            return RuntimeStatus("unconfirmed", code="cancellation_ownership_unverified", message="The cancellation target ownership is unverified.")
        current = self.status(handle)
        if current.state in {"completed", "failed", "cancelled"}:
            return current
        raw = self._read("/queue")
        running = raw.get("queue_running") if isinstance(raw, dict) else None
        if not isinstance(running, list) or len(running) != 1:
            return RuntimeStatus("unconfirmed", code="cancellation_unconfirmed", message="No exclusively owned running target was confirmed.")
        row = running[0]
        if not isinstance(row, list) or len(row) < 4 or row[1] != handle or row[2] != graph or not isinstance(row[3], dict) or row[3].get("client_id") != str(request.attempt_id):
            return RuntimeStatus("unconfirmed", code="cancellation_ownership_unverified", message="The current Runtime Job differs from the saved cancellation mapping.")
        reply = self._post("/api/jobs/" + quote(handle, safe="") + "/cancel", {})
        if not isinstance(reply, dict) or type(reply.get("cancelled")) is not bool:
            return RuntimeStatus("unconfirmed", code="cancellation_unconfirmed", message="Cancellation dispatch could not be confirmed.")
        # Pinned target-aware endpoint guards the queue mutex itself. Dispatch is
        # never terminal proof: history and the normalized target remain authoritative.
        return self.status(handle)

    def recover(self, request: RuntimeRequest) -> SubmissionReceipt:
        matches: list[str] = []
        queue = self._read("/queue")
        if isinstance(queue, dict):
            for key in ("queue_running", "queue_pending"):
                rows = queue.get(key)
                if isinstance(rows, list):
                    matches.extend(str(row[1]) for row in rows if isinstance(row, list) and len(row) > 3 and isinstance(row[3], dict) and row[3].get("client_id") == str(request.attempt_id))
        history = self._read("/history")
        if isinstance(history, dict):
            for handle, entry in history.items():
                prompt = entry.get("prompt") if isinstance(entry, dict) else None
                if isinstance(prompt, list) and len(prompt) > 3 and isinstance(prompt[3], dict) and prompt[3].get("client_id") == str(request.attempt_id):
                    matches.append(str(handle))
        unique = list(dict.fromkeys(matches))
        if len(unique) != 1:
            return SubmissionReceipt("unconfirmed", code="submission_unconfirmed")
        self.requests[unique[0]] = request
        return SubmissionReceipt("accepted", unique[0])

    def result(self, handle: str, operation: Operation) -> RuntimeResult:
        entry = self._history(handle)
        if entry is None:
            raise ValueError("Native terminal result is unavailable")
        outputs = entry.get("outputs")
        if not isinstance(outputs, dict):
            raise ValueError("Native output map is unavailable")
        workflow = self.registry.workflow(operation)
        mapping = cast(dict[str, dict[str, object]], workflow.manifest["output_mapping"])
        score_mapping = mapping["abc" if operation == "Transcribe" else "score"]
        score_output = outputs.get(str(score_mapping["node"]))
        values = score_output.get(str(score_mapping.get("field", score_mapping.get("key")))) if isinstance(score_output, dict) else None
        if not isinstance(values, list) or len(values) != 1 or not isinstance(values[0], str):
            raise ValueError("Native ABC output is missing")
        abc = values[0]
        parsed = self._post("/yue2/score/read", {"abc": abc})
        sheet = parsed.get("sheet") if isinstance(parsed, dict) else None
        if not isinstance(sheet, dict) or sheet.get("cut") is not False or not sheet.get("bars") or not isinstance(sheet.get("notes"), dict):
            raise ValueError("Native ABC parser returned no complete Score")
        seconds = sheet.get("seconds")
        if not isinstance(seconds, (int, float)) or isinstance(seconds, bool) or not math.isfinite(seconds) or seconds <= 0:
            raise ValueError("Native Score duration is invalid")
        parts = sheet["notes"]
        if not all(isinstance(part, list) for part in parts.values()):
            raise ValueError("Native Score note parts are invalid")
        notes = [note for part in parts.values() for note in part]
        if not notes or any(not isinstance(note, dict) or type(note.get("pitch")) is not int or not 0 <= note["pitch"] <= 127 or type(note.get("length")) not in (int, float) or not math.isfinite(note["length"]) or note["length"] <= 0 for note in notes):
            raise ValueError("Native parsed Score has no valid notes")
        artifacts = [RuntimeArtifact("abc", abc.encode("utf-8"), "abc", "text/vnd.abc", "score.abc")]
        if operation == "Transcribe":
            exported = self._post("/yue2/score/midi", {"abc": abc})
            encoded = exported.get("data") if isinstance(exported, dict) else None
            if not isinstance(encoded, str):
                raise ValueError("Native MIDI output is missing")
            midi = base64.b64decode(encoded, validate=True)
            uploaded_midi = self._upload_bytes(midi, "score.mid", "application/" + str(self.requests[handle].attempt_id))
            midi_name = "/".join(filter(None, [str(uploaded_midi.get("subfolder", "")), str(uploaded_midi["name"])]))
            read_midi = self._post("/yue2/midi/tracks", {"name": midi_name, "mode": "melody"})
            parts = read_midi.get("parts") if isinstance(read_midi, dict) else None
            if not isinstance(parts, list) or not parts or any(not isinstance(part, dict) or type(part.get("notes")) is not int for part in parts) or sum(part["notes"] for part in parts) <= 0:
                raise ValueError("Native MIDI reader found no readable notes")
            artifacts.append(RuntimeArtifact("midi", midi, "mid", "audio/midi", "score.mid"))
        else:
            audio_mapping = mapping["audio"]
            audio_output = outputs.get(str(audio_mapping["node"]))
            descriptions = audio_output.get(str(audio_mapping["key"])) if isinstance(audio_output, dict) else None
            if not isinstance(descriptions, list) or len(descriptions) != 1 or not isinstance(descriptions[0], dict):
                raise ValueError("Native Audio output is missing")
            descriptor = descriptions[0]
            query = urlencode({key: descriptor.get(key, "output" if key == "type" else "") for key in ("filename", "subfolder", "type")})
            with urlopen(self.url + "/view?" + query, timeout=self.settings.runtime_timeout_seconds) as response:
                body = response.read(self.settings.max_upload_bytes + 1)
            if not body or len(body) > self.settings.max_upload_bytes:
                raise ValueError("Native Audio output exceeds the configured import budget")
            filename = str(descriptor["filename"])
            format: Literal["flac", "wav"] = "flac" if filename.lower().endswith(".flac") else "wav"
            artifacts.append(RuntimeArtifact("audio", body, format, "audio/flac" if format == "flac" else "audio/wav", filename))
        status = entry.get("status")
        messages = status.get("messages") if isinstance(status, dict) else None
        started, ended, cached = None, None, None
        if isinstance(messages, list):
            for event in messages:
                if not isinstance(event, list) or len(event) != 2 or not isinstance(event[1], dict):
                    continue
                stamp = event[1].get("timestamp")
                if event[0] == "execution_start" and isinstance(stamp, (int, float)) and not isinstance(stamp, bool):
                    started = float(stamp)
                elif event[0] == "execution_success" and isinstance(stamp, (int, float)) and not isinstance(stamp, bool):
                    ended = float(stamp)
                elif event[0] == "execution_cached" and isinstance(event[1].get("nodes"), list):
                    cached = str(workflow.manifest.get("execution_node", workflow.manifest.get("core_node"))) in event[1]["nodes"]
        seconds = (ended - started) / 1000 if started is not None and ended is not None and ended > started and math.isfinite(ended - started) else None
        provenance: dict[str, object] = dict(runtime_kind="comfyui", execution_seconds=seconds, core_cached=cached,
                                           timing_scope="Native execution_start to execution_success including Workflow overhead; unavailable without comparable events")
        return RuntimeResult(tuple(artifacts), provenance=provenance, score_validation={"valid": True, "note_count": len(notes), "parser": "/yue2/score/read", "abc_sha256": hashlib.sha256(abc.encode()).hexdigest()})
