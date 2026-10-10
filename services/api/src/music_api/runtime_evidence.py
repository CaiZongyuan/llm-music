"""Read-only owner receipts and CPU binding checks; no native HTTP or CUDA probe."""

from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import os
import subprocess
import sys
import tempfile
from typing import Literal
from urllib.parse import urlsplit

import psutil
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from music_api.runtime_types import ModelEvidence, ModelRequirement, RuntimeAttestation, RuntimeRequirements


class ModelFingerprint(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    resolved_path: Path
    size_bytes: int = Field(ge=0)
    mtime_ns: int = Field(ge=0)


class ModelReceipt(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    id: str = Field(min_length=1)
    state: Literal["missing", "downloading", "ready", "invalid"]
    revision: str = Field(pattern=r"^[0-9a-f]{40}$")
    checked_at: AwareDatetime
    actual_sha256: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    actual_size_bytes: int | None = Field(default=None, ge=0)
    fingerprint: ModelFingerprint | None = None


class ProcessReceipt(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    pid: int = Field(gt=0)
    create_time: float = Field(gt=0, allow_inf_nan=False)
    executable: Path
    entrypoint: Path


class RuntimeReceipt(BaseModel):
    """Owner source timestamps remain immutable when the JSON is read or saved."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    schema_version: Literal[1]
    mode: Literal["comfyui"]
    runtime_url: str = Field(min_length=1)
    source: str = Field(min_length=1, max_length=500)
    checked_at: AwareDatetime
    runtime_root: Path
    models_root: Path
    runtime_revision: str = Field(pattern=r"^[0-9a-f]{40}$")
    plugin_revision: str = Field(pattern=r"^[0-9a-f]{40}$")
    process: ProcessReceipt
    models: list[ModelReceipt]


def current_binding(receipt: RuntimeReceipt, runtime_url: str, requirements: RuntimeRequirements) -> tuple[str, ...]:
    try:
        endpoint = urlsplit(runtime_url)
        if endpoint.scheme != "http" or endpoint.hostname not in {"127.0.0.1", "localhost", "::1"} or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment or endpoint.path not in {"", "/"}:
            return ("runtime_evidence_identity_mismatch",)
        port = endpoint.port or 80
        process = psutil.Process(receipt.process.pid)
        if process.create_time() != receipt.process.create_time:
            return ("runtime_process_identity_changed",)
        if Path(process.exe()).resolve(strict=True) != receipt.process.executable.resolve(strict=True):
            return ("runtime_process_identity_changed",)
        command = process.cmdline()
        if len(command) < 2:
            return ("runtime_process_identity_changed",)
        entrypoint = Path(command[1])
        if not entrypoint.is_absolute():
            entrypoint = Path(process.cwd()) / entrypoint
        expected = receipt.process.entrypoint.resolve(strict=True)
        runtime_root = receipt.runtime_root.resolve(strict=True)
        if entrypoint.resolve(strict=True) != expected or expected != runtime_root / "main.py":
            return ("runtime_process_identity_changed",)
        addresses = {"127.0.0.1", "::1"} if endpoint.hostname == "localhost" else {endpoint.hostname}
        if not any(connection.status == psutil.CONN_LISTEN and connection.laddr.port == port and connection.laddr.ip in addresses
                   for connection in process.net_connections(kind="tcp")):
            return ("runtime_listener_identity_changed",)
        model_root_value = process.environ().get("YUE2_MODELS_ROOT")
        if not model_root_value or Path(model_root_value).resolve(strict=True) != receipt.models_root.resolve(strict=True):
            return ("runtime_model_layout_changed",)
        for path, revision in [(runtime_root, requirements.runtime_revision),
                               (runtime_root / "custom_nodes" / "YuE2-ComfyUI", requirements.plugin_revision)]:
            actual = subprocess.run(["git", "-C", str(path), "rev-parse", "HEAD"], check=True, capture_output=True, text=True, timeout=5).stdout.strip()
            dirty = subprocess.run(["git", "-C", str(path), "status", "--porcelain", "--untracked-files=no"], check=True, capture_output=True, text=True, timeout=5).stdout.strip()
            if actual != revision or dirty:
                return ("runtime_source_revision_changed",)
        if not process.is_running() or process.create_time() != receipt.process.create_time:
            return ("runtime_process_identity_changed",)
        return ()
    except (psutil.Error, OSError, ValueError, subprocess.SubprocessError):
        return ("runtime_binding_unavailable",)


def model_evidence(item: ModelReceipt, receipt: RuntimeReceipt, requirement: ModelRequirement,
                   now: datetime, max_age_seconds: float) -> ModelEvidence:
    # The original hash proof is tied to this fingerprint, not to a clock TTL.
    def observed(state: Literal["missing", "downloading", "ready", "invalid", "unknown"], *codes: str) -> ModelEvidence:
        return ModelEvidence(item.id, state, receipt.source, item.checked_at, item.actual_sha256, tuple(codes))

    age = (now - item.checked_at).total_seconds()
    if age < 0:
        return observed("unknown", "model_evidence_future")
    if item.revision != requirement.revision:
        return observed("invalid", "model_revision_mismatch")
    path = receipt.models_root / requirement.local_path
    try:
        if not path.is_file():
            return observed("downloading" if path.with_name(path.name + ".part").exists() else "missing", "model_missing")
        if item.state != "ready":
            return observed("invalid" if item.state == "invalid" else "unknown", "model_verification_unavailable")
        if item.actual_sha256 != requirement.sha256 or item.actual_size_bytes != requirement.size_bytes:
            return observed("invalid", "model_hash_invalid")
        fingerprint = item.fingerprint
        actual = path.stat()
        if fingerprint is None or path.resolve(strict=True) != fingerprint.resolved_path.resolve(strict=True) or actual.st_size != fingerprint.size_bytes or actual.st_mtime_ns != fingerprint.mtime_ns or fingerprint.size_bytes != item.actual_size_bytes:
            return observed("unknown", "model_fingerprint_changed")
        return observed("ready")
    except OSError:
        return observed("unknown", "model_layout_unavailable")


def read_runtime_evidence(path: Path | None, *, runtime_url: str, now: datetime,
                          max_age_seconds: float, requirements: RuntimeRequirements) -> RuntimeAttestation:
    # Retain the keyword for callers; immutable proof is validated by current identity.
    if path is None:
        return RuntimeAttestation("comfyui", runtime_url, "owner receipt unavailable", None, False, None, None,
                                  reasons=("runtime_evidence_unavailable",))
    try:
        if path.stat().st_size > 131072:
            raise ValueError("Receipt exceeds the bounded source document size")
        receipt = RuntimeReceipt.model_validate_json(path.read_bytes())
    except (OSError, ValueError):
        return RuntimeAttestation("comfyui", runtime_url, "owner receipt unavailable", None, False, None, None,
                                  reasons=("runtime_evidence_invalid",))

    age = (now - receipt.checked_at).total_seconds()
    reasons = []
    if age < 0:
        reasons.append("runtime_evidence_future")
    if receipt.runtime_url.rstrip("/") != runtime_url.rstrip("/"):
        reasons.append("runtime_evidence_identity_mismatch")
    if receipt.runtime_revision != requirements.runtime_revision or receipt.plugin_revision != requirements.plugin_revision:
        reasons.append("runtime_evidence_revision_mismatch")
    if len({model.id for model in receipt.models}) != len(receipt.models):
        reasons.append("runtime_evidence_duplicate_models")
    if not reasons:
        reasons.extend(current_binding(receipt, runtime_url, requirements))

    if reasons:
        models = tuple(ModelEvidence(item.id, "unknown", receipt.source, item.checked_at, item.actual_sha256,
                                     tuple(reasons)) for item in receipt.models)
    else:
        by_id = {item.id: item for item in receipt.models}
        models = tuple(model_evidence(by_id[required.id], receipt, required, now, max_age_seconds)
                       if required.id in by_id else ModelEvidence(required.id, "unknown", receipt.source, None,
                                                                 reasons=("model_verification_unavailable",))
                       for required in requirements.models)
    return RuntimeAttestation("comfyui", runtime_url, receipt.source, receipt.checked_at, not reasons,
                              receipt.runtime_revision, receipt.plugin_revision, models, tuple(reasons))


def collect_runtime_evidence(runtime_url: str, pid: int, requirements: RuntimeRequirements) -> RuntimeReceipt:
    """Explicit owner command hashes weights; application requests never call this."""
    process = psutil.Process(pid)
    command = process.cmdline()
    if len(command) < 2:
        raise ValueError("runtime_process_identity_changed")
    entrypoint = Path(command[1])
    if not entrypoint.is_absolute():
        entrypoint = Path(process.cwd()) / entrypoint
    entrypoint = entrypoint.resolve(strict=True)
    root_value = process.environ().get("YUE2_MODELS_ROOT")
    if not root_value:
        raise ValueError("runtime_model_layout_unavailable")
    receipt = RuntimeReceipt(schema_version=1, mode="comfyui", runtime_url=runtime_url,
                             source="Owner CPU collection: current local binding, clean pinned sources and full-file SHA256",
                             checked_at=datetime.now(timezone.utc), runtime_root=entrypoint.parent,
                             models_root=Path(root_value).resolve(strict=True),
                             runtime_revision=requirements.runtime_revision, plugin_revision=requirements.plugin_revision,
                             process=ProcessReceipt(pid=pid, create_time=process.create_time(), executable=Path(process.exe()), entrypoint=entrypoint),
                             models=[])
    problems = current_binding(receipt, runtime_url, requirements)
    if problems:
        raise ValueError(problems[0])
    models = []
    for required in requirements.models:
        path = receipt.models_root / required.local_path
        if not path.is_file():
            models.append(ModelReceipt(id=required.id, state="downloading" if path.with_name(path.name + ".part").exists() else "missing",
                                       revision=required.revision, checked_at=datetime.now(timezone.utc)))
            continue
        before = path.stat()
        resolved = path.resolve(strict=True)
        with path.open("rb") as handle:
            digest = hashlib.file_digest(handle, "sha256").hexdigest()
        after = path.stat()
        if resolved != path.resolve(strict=True) or (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise ValueError("model_changed_during_hash")
        state: Literal["ready", "invalid"] = "ready" if digest == required.sha256 and after.st_size == required.size_bytes else "invalid"
        models.append(ModelReceipt(id=required.id, state=state, revision=required.revision,
                                   checked_at=datetime.now(timezone.utc), actual_sha256=digest, actual_size_bytes=after.st_size,
                                   fingerprint=ModelFingerprint(resolved_path=resolved, size_bytes=after.st_size, mtime_ns=after.st_mtime_ns)))
    problems = current_binding(receipt, runtime_url, requirements)
    if problems:
        raise ValueError(problems[0])
    return receipt.model_copy(update={"checked_at": datetime.now(timezone.utc), "models": models})


def publish_receipt(receipt: RuntimeReceipt, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        previous_bytes = output.read_bytes()
        previous = RuntimeReceipt.model_validate_json(previous_bytes)
        if previous.mode != receipt.mode or previous.runtime_url.rstrip("/") != receipt.runtime_url.rstrip("/") or previous.runtime_root.resolve() != receipt.runtime_root.resolve() or previous.models_root.resolve() != receipt.models_root.resolve():
            raise ValueError("receipt_namespace_mismatch")
        stamp = previous.checked_at.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
        archive = output.with_name(output.stem + ".previous." + stamp + ".json")
        if archive.exists():
            if archive.read_bytes() != previous_bytes:
                raise ValueError("receipt_archive_conflict")
        else:
            with archive.open("xb") as handle:
                handle.write(previous_bytes)
                handle.flush()
                os.fsync(handle.fileno())
    descriptor, name = tempfile.mkstemp(dir=output.parent, suffix=".receipt.part")
    staged = Path(name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write((receipt.model_dump_json(indent=2) + "\n").encode("utf-8"))
            handle.flush()
            os.fsync(handle.fileno())
        staged.replace(output)
    finally:
        staged.unlink(missing_ok=True)


def main() -> None:
    from music_api.workflow_registry import WorkflowRegistry

    parser = argparse.ArgumentParser(description="Collect a read-only Runtime source receipt in the CPU-only application environment.")
    parser.add_argument("command", choices=["collect"])
    parser.add_argument("--runtime-url", default="http://127.0.0.1:8188")
    parser.add_argument("--pid", type=int, required=True, help="Actual owned listener PID, not a launcher PID")
    parser.add_argument("--output", type=Path, required=True, help="Owner-managed receipt; prior validated receipt is archived on refresh")
    parser.add_argument("--repository-root", type=Path, help="Registry source root; defaults to this repository")
    arguments = parser.parse_args()
    try:
        requirements = WorkflowRegistry(arguments.repository_root).requirements()
        receipt = collect_runtime_evidence(arguments.runtime_url, arguments.pid, requirements)
        publish_receipt(receipt, arguments.output)
    except (psutil.Error, OSError, ValueError, subprocess.SubprocessError):
        print("Owner receipt collection failed. Check current local process access, pinned source and model layout; retain the previous receipt.", file=sys.stderr)
        raise SystemExit(1)
    if any(model.state != "ready" for model in receipt.models):
        print("Owner receipt records missing, downloading or invalid weights; restore the registered files before submission.", file=sys.stderr)
        raise SystemExit(1)
    print("Owner receipt collected. API requests verify current health, process/source identity and model fingerprints.")


if __name__ == "__main__":
    main()
