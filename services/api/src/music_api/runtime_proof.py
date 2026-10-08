"""Backend-private immutable original requests; never rebuilt from a newer registry."""

from copy import deepcopy
import hashlib
import json
from typing import Mapping, cast

from music_api.runtime_types import OPERATIONS, Operation, RuntimeMode, RuntimeRequest
from music_api.workflow_registry import WorkflowDefinition


def digest(value: object) -> str:
    serialized = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def freeze(request: RuntimeRequest, mode: RuntimeMode, endpoint: str, workflow: WorkflowDefinition,
           graph: Mapping[str, object], upload: Mapping[str, object] | None = None) -> dict[str, object]:
    original = dict(operation=workflow.operation, id=workflow.id, version=workflow.version,
                    required_models=list(workflow.required_models), required_nodes=list(workflow.required_nodes),
                    manifest_sha256=workflow.manifest_sha256, definition_sha256=workflow.definition_sha256,
                    manifest=deepcopy(dict(workflow.manifest)), graph=deepcopy(dict(workflow.graph)))
    body: dict[str, object] = dict(version=1, mode=mode, endpoint=endpoint, attempt_id=str(request.attempt_id),
                                   operation=request.operation, inputs=deepcopy(dict(request.inputs)),
                                   workflow=original, graph=deepcopy(dict(graph)), upload=deepcopy(upload))
    return dict(body, sha256=digest(body))


def validate(request: RuntimeRequest, mode: RuntimeMode, endpoint: str) -> dict[str, object]:
    value = deepcopy(dict(request.proof or {}))
    claimed = value.pop("sha256", None)
    if not value or type(value.get("version")) is not int or value["version"] != 1 or claimed != digest(value):
        raise ValueError("Original Runtime proof is unavailable or invalid")
    if (value.get("mode"), value.get("endpoint"), value.get("attempt_id"), value.get("operation"), value.get("inputs")) != (
            mode, endpoint, str(request.attempt_id), request.operation, dict(request.inputs)):
        raise ValueError("Original Runtime proof differs from this request binding")
    if not isinstance(value.get("graph"), dict) or not isinstance(value.get("workflow"), dict):
        raise ValueError("Original Runtime proof has no complete graph or workflow")
    return value


def workflow_from(value: Mapping[str, object]) -> WorkflowDefinition:
    item = value["workflow"]
    if not isinstance(item, dict) or item.get("operation") not in OPERATIONS:
        raise ValueError("Original workflow is unavailable")
    for key in ("manifest", "graph"):
        if not isinstance(item.get(key), dict):
            raise ValueError("Original workflow object is unavailable")
    for key in ("id", "version", "manifest_sha256", "definition_sha256"):
        if not isinstance(item.get(key), str):
            raise ValueError("Original workflow source fact is unavailable")
    for key in ("required_models", "required_nodes"):
        if not isinstance(item.get(key), list) or not all(isinstance(part, str) for part in item[key]):
            raise ValueError("Original workflow requirements are unavailable")
    return WorkflowDefinition(operation=cast(Operation, item["operation"]), id=item["id"], version=item["version"],
                              required_models=tuple(item["required_models"]), required_nodes=tuple(item["required_nodes"]),
                              manifest_sha256=item["manifest_sha256"], definition_sha256=item["definition_sha256"],
                              manifest=deepcopy(item["manifest"]), graph=deepcopy(item["graph"]))
