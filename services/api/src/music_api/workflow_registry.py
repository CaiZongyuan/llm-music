"""The two P0-proven workflow entries and their authoritative source facts."""

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
from typing import Mapping, cast

from music_api.runtime_types import ModelRequirement, Operation, RuntimeRequirements


@dataclass(frozen=True)
class WorkflowDefinition:
    operation: Operation
    id: str
    version: str
    required_models: tuple[str, ...]
    required_nodes: tuple[str, ...]
    manifest_sha256: str
    definition_sha256: str
    manifest: Mapping[str, object]
    graph: Mapping[str, object]


def read_object(path: Path) -> dict[str, object]:
    value: object = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("Registry source must be a JSON object")
    return cast(dict[str, object], value)


def text(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("Registry text fact is unavailable")
    return value


def strings(value: object) -> tuple[str, ...]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ValueError("Registry string list is unavailable")
    return tuple(cast(list[str], value))


class WorkflowRegistry:
    def __init__(self, repository_root: Path | None = None) -> None:
        self.root = repository_root or Path(__file__).resolve().parents[4]
        runtime = read_object(self.root / "runtime/comfyui/runtime.json")
        sources = cast(dict[str, dict[str, object]], runtime["sources"])
        models = cast(list[dict[str, object]], read_object(self.root / "runtime/comfyui/models.json")["models"])
        self._requirements = RuntimeRequirements(
            runtime_revision=text(sources["comfyui"]["revision"]), plugin_revision=text(sources["plugin"]["revision"]),
            python_version=text(runtime["python"]), torch_version=text(runtime["torch"]), gpu_name=text(runtime["gpu_name"]),
            min_vram_mib=int(cast(int, runtime["min_vram_mib"])),
            runtime_code_license=text(sources["comfyui"]["code_license"]), runtime_license_source=text(sources["comfyui"]["license_source"]),
            plugin_code_license=text(sources["plugin"]["code_license"]), plugin_license_source=text(sources["plugin"]["license_source"]),
            models=tuple(ModelRequirement(id=text(model["id"]), name=text(model["name"]), provider=text(model["provider"]),
                                          repository=text(model["repository"]), revision=text(model["revision"]), filename=text(model["filename"]),
                                          local_path=text(model["local_path"]), sha256=text(model["sha256"]), size_bytes=int(cast(int, model["size_bytes"])),
                                          weights_license=text(model["weights_license"]), license_source=text(model["license_source"]),
                                          hash_source=text(model["hash_source"]), components=strings(model["components"]),
                                          component_license_notes=cast(str | None, model.get("component_license_notes"))) for model in models))
        paths: dict[Operation, Path] = {
            "Transcribe": self.root / "runtime/comfyui/workflows/transcribe-sheetsage2/v1",
            "Generate": self.root / "workflows/generate",
            "GenerateFromScore": self.root / "workflows/generate-from-score/v1",
        }
        self._workflows: dict[Operation, WorkflowDefinition] = {}
        for operation, directory in paths.items():
            manifest_path, definition_path = directory / "manifest.json", directory / "workflow.json"
            manifest, graph = read_object(manifest_path), read_object(definition_path)
            self._workflows[operation] = WorkflowDefinition(operation, text(manifest["id"]), text(manifest["version"]),
                                                         strings(manifest["required_models"]), strings(manifest["required_nodes"]),
                                                         hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
                                                         hashlib.sha256(definition_path.read_bytes()).hexdigest(), manifest, graph)
        score_settings = self.settings("GenerateFromScore")
        if score_settings.get("cot") not in {"full", "melody"} or score_settings.get("transpose") != 0:
            raise ValueError("GenerateFromScore must retain a Score and preserve its selected pitches")

    def requirements(self) -> RuntimeRequirements:
        return self._requirements

    def workflow(self, operation: Operation) -> WorkflowDefinition:
        return self._workflows[operation]

    def settings(self, operation: Operation) -> dict[str, object]:
        """Expose pinned operation settings without requiring callers to know node ids."""
        values = [node.get("inputs") for node in self.workflow(operation).graph.values()
                  if isinstance(node, dict) and node.get("class_type") == "YuE2Options"]
        if len(values) != 1 or not isinstance(values[0], dict):
            raise ValueError("Pinned operation has no unique settings descriptor")
        return dict(cast(dict[str, object], values[0]))
