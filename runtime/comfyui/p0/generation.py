"""Prepare and verify one fixed P0 Generate request through the Runtime API."""

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import urlsplit
import uuid
import wave

if __package__:
    from .metrics import MemorySampler, RuntimeLogs
    from .runtime_client import RuntimeClient, RuntimeFailure
    from .score_validation import validate_abc
else:
    from metrics import MemorySampler, RuntimeLogs
    from runtime_client import RuntimeClient, RuntimeFailure
    from score_validation import validate_abc


PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parents[1]
WORKFLOW = ROOT / "workflows" / "generate"


class GenerationFailure(RuntimeError):
    def __init__(self, code, message, recovery, details=None):
        self.code, self.recovery, self.details = code, recovery, details
        super().__init__(message)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def tool_provenance():
    head = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    state = subprocess.run(["git", "-C", str(ROOT), "status", "--porcelain"], capture_output=True, text=True, check=True).stdout.strip()
    files = ["generation.py", "metrics.py", "runtime_client.py", "score_validation.py"]
    return dict(revision=head, working_tree=state, python=sys.version,
                source_sha256={name: sha256(PROJECT / "p0" / name) for name in files})


def event(output, status, **facts):
    with (output / "events.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dict(at=datetime.now(timezone.utc).isoformat(), status=status, progress=None, **facts), ensure_ascii=False) + "\n")


def prepare(args):
    inputs = read_json(args.input)
    if not isinstance(inputs, dict) or inputs.get("schema_version") != 1:
        raise ValueError("Generation input must be a schema_version=1 object")
    if any(not isinstance(inputs.get(field), str) or not inputs[field].strip() for field in ["style", "lyrics"]):
        raise ValueError("Fixed generation style and lyrics must both be nonempty strings")
    if type(inputs.get("seed")) is not int or not 0 <= inputs["seed"] <= (1 << 63) - 1:
        raise ValueError("Generation seed must be an integer in the pinned node range")
    if type(inputs.get("max_seconds")) not in (int, float) or not math.isfinite(inputs["max_seconds"]) or not 30 <= inputs["max_seconds"] <= 40:
        raise ValueError("P0 generation max_seconds must stay within 30–40 seconds")
    manifest = read_json(WORKFLOW / "manifest.json")
    graph = deepcopy(read_json(WORKFLOW / "workflow.json"))
    for field, location in manifest["input_mapping"].items():
        graph[location["node"]]["inputs"][location["input"]] = inputs[field]
    args.oom_comparison = None
    if args.low_vram_after_oom:
        previous = read_json(args.low_vram_after_oom)
        settings = graph[manifest["settings_node"]]["inputs"]
        expected_inputs = {field: inputs[field] for field in manifest["input_mapping"]}
        if (previous.get("status") != "failed" or previous.get("error", {}).get("code") != "runtime_out_of_memory"
                or previous.get("evidence_kind") != args.evidence_kind
                or previous.get("provenance", {}).get("input_values") != expected_inputs
                or previous.get("provenance", {}).get("settings") != settings
                or previous.get("provenance", {}).get("workflow", {}).get("definition_sha256") != sha256(WORKFLOW / "workflow.json")):
            raise GenerationFailure("oom_comparison_invalid", "low_vram retry requires an OOM baseline with identical inputs, source Workflow and all baseline inference settings.",
                                    "Retain the actual baseline OOM report. Do not use this switch for successful, different, or unverified runs.")
        settings["low_vram"] = True
        args.oom_comparison = dict(baseline_report=str(args.low_vram_after_oom.resolve()), baseline_report_sha256=sha256(args.low_vram_after_oom),
                                   changed_inference_fields=["low_vram"], original_value=False, new_value=True)
    run_id = uuid.uuid4().hex
    graph[manifest["output_mapping"]["audio"]["node"]]["inputs"]["filename_prefix"] = f"p0/generate/{run_id}"
    args.output_dir.mkdir(parents=True, exist_ok=False)
    write_json(args.output_dir / "input.json", inputs)
    write_json(args.output_dir / "request.json", graph)
    write_json(args.output_dir / "manifest.json", manifest)
    return inputs, manifest, graph, run_id


def verify_models(registry_path, models_root, required):
    registry = read_json(registry_path)
    verified = []
    for identifier in required:
        model = next((model for model in registry["models"] if model["id"] == identifier), None)
        if model is None:
            raise GenerationFailure("model_missing", f"Required model {identifier} is not registered.", "Restore the pinned Model Registry.")
        relative = Path(model["local_path"])
        if relative.is_absolute() or relative.drive or ".." in relative.parts:
            raise GenerationFailure("model_invalid", "Model path leaves its configured root.", "Restore the pinned Model Registry.")
        path = models_root / relative
        if not path.is_file():
            raise GenerationFailure("model_missing", f"Required model is missing: {path}", "Run the Runtime model preparation command; this tool never downloads weights.")
        actual_size, actual_hash = path.stat().st_size, sha256(path)
        if actual_size != model["size_bytes"] or actual_hash != model["sha256"]:
            raise GenerationFailure("model_invalid", f"Pinned model size/SHA256 does not match: {path}", "Preserve the corrupt file and restore the pinned legal weights.")
        verified.append(dict(model, path=str(path.resolve()), actual_size_bytes=actual_size,
                             actual_sha256=actual_hash, state="ready", mtime_ns=path.stat().st_mtime_ns))
    return verified


def validate_schema(info, graph):
    for node in graph.values():
        kind = node["class_type"]
        if kind not in info:
            raise GenerationFailure("workflow_invalid", f"Required node {kind} is unavailable.", "Restore the pinned Runtime/plugin and run Doctor.")
        schema = info[kind].get("input", {})
        allowed = dict(schema.get("required", {}), **schema.get("optional", {}))
        if not set(schema.get("required", {})).issubset(node["inputs"]):
            raise GenerationFailure("workflow_invalid", f"Workflow lacks required {kind} inputs.", "Restore the versioned generation Workflow.")
        for name, value in node["inputs"].items():
            if name not in allowed:
                raise GenerationFailure("workflow_invalid", f"Runtime does not accept {kind}.{name}.", "Compare the pinned Workflow with the actual object_info schema.")
            choices = allowed[name][0]
            if isinstance(choices, list) and value not in choices:
                raise GenerationFailure("workflow_invalid", f"Runtime does not accept {kind}.{name}={value}.", "Restore the pinned baseline settings.")


def decode_audio(path):
    """Read every frame; a header/duration alone does not establish decodability."""
    try:
        if path.suffix.lower() == ".wav":
            with wave.open(str(path), "rb") as reader:
                rate, channels = reader.getframerate(), reader.getnchannels()
                width, expected = reader.getsampwidth(), reader.getnframes()
                count = 0
                while chunk := reader.readframes(16384):
                    if len(chunk) % (width * channels):
                        raise ValueError("Truncated PCM frame")
                    count += len(chunk) // (width * channels)
                if count != expected:
                    raise ValueError("WAV body does not match its declared frame count")
            decoder = "Python wave; complete PCM frame read"
        else:
            import av
            import numpy as np

            count = 0
            with av.open(str(path)) as container:
                streams = list(container.streams.audio)
                if len(streams) != 1:
                    raise ValueError("Expected one audio stream")
                rate, channels = streams[0].codec_context.sample_rate, len(streams[0].codec_context.layout.channels)
                for frame in container.decode(streams[0]):
                    if frame.sample_rate != rate or not np.isfinite(frame.to_ndarray()).all():
                        raise ValueError("Inconsistent sample rate or non-finite decoded samples")
                    count += frame.samples
            decoder = "PyAV; every frame decoded and finite samples checked"
        if rate <= 0 or channels <= 0 or count <= 0:
            raise ValueError("Audio has no readable samples")
        return dict(duration_seconds=count / rate, decoded_frames=count, sample_rate=rate,
                    channels=channels, decoder=decoder, sha256=sha256(path), bytes=path.stat().st_size,
                    listening_review="pending")
    except (OSError, ValueError, EOFError, wave.Error, ImportError) as error:
        raise GenerationFailure("audio_invalid", f"Audio cannot be completely decoded: {error}", "Retain the artifact and inspect the Runtime logs; use the pinned environment for FLAC decoding.") from error


def execution_measurements(entry, core_node, duration):
    messages = entry.get("status", {}).get("messages", [])
    starts = [item[1]["timestamp"] for item in messages if item[0] == "execution_start" and "timestamp" in item[1]]
    ends = [item[1]["timestamp"] for item in messages if item[0] == "execution_success" and "timestamp" in item[1]]
    cached = sorted({str(node) for item in messages if item[0] == "execution_cached" for node in item[1].get("nodes", [])})
    elapsed = (ends[-1] - starts[0]) / 1000 if starts and ends else None
    if elapsed is not None and (not math.isfinite(elapsed) or elapsed < 0):
        elapsed = None
    core_cached = core_node in cached
    return dict(execution_seconds=elapsed, rtf=elapsed / duration if elapsed is not None and not core_cached else None,
                execution_timing_scope="ComfyUI history execution_start to execution_success, including saving nodes; milliseconds converted to seconds",
                rtf_scope="Workflow execution seconds / fully decoded output audio seconds; not a model-only RTF",
                cached_nodes=cached, core_cached=core_cached)


def failure_record(error):
    if isinstance(error, GenerationFailure):
        return dict(code=error.code, message=str(error), recovery=error.recovery, details=error.details)
    code = "runtime_unavailable" if isinstance(error, RuntimeFailure) else "generation_failed"
    recovery = "Retain the request and inspect the owned Runtime/history before retrying. No interrupt or automatic submission retry is performed."
    details = getattr(error, "details", None)
    if isinstance(error, RuntimeFailure) and error.endpoint == "/prompt":
        code = "workflow_invalid"
    if isinstance(details, dict):
        for message in details.get("status", {}).get("messages", []):
            if message[0] == "execution_error":
                diagnostic = message[1]
                text = str(diagnostic.get("exception_message", "")).lower()
                exception = str(diagnostic.get("exception_type", ""))
                code = "runtime_out_of_memory" if exception.endswith("OutOfMemoryError") or "cuda out of memory" in text else "generation_failed"
                if code == "runtime_out_of_memory":
                    recovery = "Preserve this baseline failure. Only the GPU owner may repeat identical inputs with low_vram=true; change no other inference variable."
    return dict(code=code, message=str(error), recovery=recovery, details=details)


def runtime_facts(args, config, manifest, observed):
    system = observed.get("system", {})
    target = next((device for device in observed.get("devices", []) if device.get("type") == "cuda" and device.get("index") == 0), {})
    capacity = target.get("vram_total")
    if (system.get("pytorch_version") != config["torch"]
            or str(system.get("python_version", "")).split(" ")[0] != config["python"]
            or config["gpu_name"] not in target.get("name", "")
            or type(capacity) is not int or (capacity + 524288) // 1048576 < config["min_vram_mib"]):
        raise GenerationFailure("runtime_unverified", "Runtime metadata does not match the pinned interpreter/Torch/target GPU.", "Use the owned pinned local Runtime and retain a successful Doctor receipt.")
    if (config["sources"]["comfyui"]["revision"] != manifest["runtime_revision"]
            or config["sources"]["plugin"]["revision"] != manifest["plugin_revision"]):
        raise GenerationFailure("workflow_invalid", "Workflow was not verified for the configured source revisions.", "Restore the matching versioned Workflow, Runtime and plugin.")
    commits = {}
    if args.evidence_kind == "real":
        for name, path in [("comfyui", args.runtime_root), ("plugin", args.runtime_root / "custom_nodes/YuE2-ComfyUI")]:
            expected = config["sources"][name]["revision"]
            commit = subprocess.run(["git", "-C", str(path), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
            dirty = subprocess.run(["git", "-C", str(path), "status", "--porcelain", "--untracked-files=no"], capture_output=True, text=True, check=True).stdout.strip()
            if commit != expected or dirty:
                raise GenerationFailure("runtime_unverified", f"Runtime {name} source is not the pinned clean checkout.", "Preserve local changes and restore the source pins before inference.")
            commits[name] = dict(revision=commit, tracked_changes=dirty)
    facts = dict(configuration=config, observed=observed, observed_source_commits=commits,
                 source_verification="actual clean checkouts" if args.evidence_kind == "real" else "fake HTTP evidence; source/GPU claims are not actual acceptance",
                 driver_version=None, driver_observability="not exposed by system_stats; retain Doctor metadata where available")
    if args.doctor_report:
        receipt = read_json(args.doctor_report)
        doctor = receipt.get("report", receipt)
        if doctor.get("ready") is not True:
            raise GenerationFailure("runtime_unverified", "Supplied Doctor receipt did not pass prerequisites.", "Retain a successful prerequisite Doctor receipt from the owned Runtime.")
        gpu = next((check for check in doctor.get("checks", []) if check.get("id") == "gpu"), {})
        devices = gpu.get("facts", {}).get("devices", [])
        selected = next((device for device in devices if device.get("name") == config["gpu_name"]), {})
        facts.update(driver_version=selected.get("driver"), driver_observability="supplied Doctor receipt; timestamp retained, not re-queried",
                     doctor_receipt_sha256=sha256(args.doctor_report))
        write_json(args.output_dir / "doctor-receipt.json", receipt)
    return facts


def run_generation(args, inputs, manifest, graph, run_id, report):
    client = RuntimeClient(args.url)
    config = read_json(PROJECT / "runtime.json")
    report["provenance"]["models"] = verify_models(args.registry, args.models_root, manifest["required_models"])
    observed = client.get_json("/system_stats")
    write_json(args.output_dir / "system-stats.json", observed)
    report["provenance"]["runtime"] = runtime_facts(args, config, manifest, observed)
    info = client.get_json("/object_info")
    validate_schema(info, graph)
    write_json(args.output_dir / "object-info.json", {name: info[name] for name in manifest["required_nodes"]})
    queue = client.get_json("/queue")
    if not isinstance(queue.get("queue_running"), list) or not isinstance(queue.get("queue_pending"), list):
        raise GenerationFailure("runtime_unverified", "Runtime queue response cannot establish an empty queue.", "Verify the owned Runtime API before submitting work.")
    if queue.get("queue_running") or queue.get("queue_pending"):
        raise GenerationFailure("runtime_busy", "Runtime has another queued/running request.", "The GPU owner must finish or safely cancel existing work before this single request.")
    sampler = MemorySampler(RuntimeClient(args.url, timeout=min(5, max(1, args.sample_interval * 3))),
                            args.sample_interval, args.output_dir / "memory-samples.jsonl",
                            args.process_pid, args.runtime_root / "main.py")
    if args.evidence_kind == "real" and sampler.process is None:
        raise GenerationFailure("runtime_owner_unverified", "The selected PID does not identify the configured Runtime process: " + str(sampler.process_error),
                                "Supply the GPU owner's actual --process-pid and --runtime-root. No job was submitted.")
    logs = RuntimeLogs(args.runtime_log, args.output_dir)
    began = time.monotonic()
    try:
        with sampler:
            report["prompt_id"] = client.submit(graph, run_id)
            report["status"] = "submitted"
            event(args.output_dir, "submitted", prompt_id=report["prompt_id"])
            write_json(args.output_dir / "report.json", report)
            entry = client.wait(report["prompt_id"], timeout=args.timeout, poll_interval=args.poll_interval)
    finally:
        report["measurements"] = dict(memory=sampler.summary(), client_submission_to_history_seconds=time.monotonic() - began)
        report["measurements"].update(logs.finish())
    write_json(args.output_dir / "history.json", entry)
    outputs = entry.get("outputs", {})
    audio_map, score_map = manifest["output_mapping"]["audio"], manifest["output_mapping"]["score"]
    descriptors = outputs.get(audio_map["node"], {}).get(audio_map["key"], [])
    scores = outputs.get(score_map["node"], {}).get(score_map["key"], [])
    if len(descriptors) != 1 or len(scores) != 1 or not isinstance(scores[0], str):
        raise GenerationFailure("output_invalid", "Successful history lacks exactly one Audio and Score.", "Retain history and inspect the Workflow output mapping.")
    descriptor = descriptors[0]
    extension = Path(descriptor["filename"]).suffix.lower()
    if extension not in {".wav", ".flac"} or descriptor.get("type") != "output":
        raise GenerationFailure("output_invalid", "Audio descriptor is not a supported Runtime output.", "Inspect the pinned audio saving node and history.")
    audio_path = args.output_dir / ("audio" + extension)
    audio_path.write_bytes(client.artifact(descriptor))
    score_path = args.output_dir / "score.abc"
    score_path.write_text(scores[0], encoding="utf-8")
    report["outputs"] = dict(audio=dict(path=audio_path.name, runtime_descriptor=descriptor, sha256=sha256(audio_path)),
                            score=dict(path=score_path.name, sha256=sha256(score_path), validation=dict(valid=False, reason="not yet validated")))
    audio = decode_audio(audio_path)
    report["outputs"]["audio"].update(audio)
    score = validate_abc(client, scores[0])
    write_json(args.output_dir / "score-read.json", score)
    report["outputs"]["score"]["validation"] = {key: value for key, value in score.items() if key != "sheet"}
    report["measurements"].update(execution_measurements(entry, manifest["core_node"], audio["duration_seconds"]))
    report["measurements"]["client_wait_and_validation_seconds"] = time.monotonic() - began
    report["measurements"]["cache_observability"] = "Core DAG cache is observed through history. Bounded pinned GenerateSong-to-run path has no output-result lookup; separate staged Plan/Latents nodes are absent. Actual stage logs are retained where supplied."
    report["measurements"]["run_condition"] = dict(label=args.run_kind, declaration="caller-declared; cold means first generation/model use in the retained Runtime session, not server/process startup",
                                                    filesystem_cache="uncontrolled; required model SHA256 read occurs before workload timing",
                                                    model_retention=False)
    if not manifest["audio_duration_seconds"]["minimum"] <= audio["duration_seconds"] <= manifest["audio_duration_seconds"]["maximum"]:
        raise GenerationFailure("duration_out_of_baseline", "Decoded audio is outside the fixed 30–40 second baseline.", "Keep the output and inputs; investigate the model's early end instead of silently changing inference variables.")
    if report["measurements"]["core_cached"]:
        raise GenerationFailure("cached_generation", "Core Generate work was served from the ComfyUI DAG cache; RTF is not a generation measurement.", "Retain this cache observation. The GPU owner must establish an uncached comparable run; do not silently change seed or settings.")
    report["status"] = "completed"



def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["prepare", "run"])
    parser.add_argument("--input", type=Path, default=WORKFLOW / "input.json")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--url", default="http://127.0.0.1:8188")
    parser.add_argument("--registry", type=Path, default=PROJECT / "models.json")
    parser.add_argument("--models-root", type=Path, default=ROOT / "data/models")
    parser.add_argument("--runtime-root", type=Path, default=PROJECT / ".upstream/ComfyUI")
    parser.add_argument("--process-pid", type=int)
    parser.add_argument("--runtime-log", action="append", type=Path, default=[])
    parser.add_argument("--doctor-report", type=Path)
    parser.add_argument("--low-vram-after-oom", type=Path, metavar="BASELINE_REPORT")
    parser.add_argument("--evidence-kind", choices=["real", "fake"], default="real")
    parser.add_argument("--run-kind", choices=["cold", "repeat", "unknown"], default="unknown")
    parser.add_argument("--timeout", type=float, default=1800)
    parser.add_argument("--poll-interval", type=float, default=1)
    parser.add_argument("--sample-interval", type=float, default=1)
    args = parser.parse_args()
    if any(not math.isfinite(value) or value <= 0 for value in [args.timeout, args.poll_interval, args.sample_interval]):
        parser.error("Timeout, polling and sampling bounds must be positive finite seconds")
    address = urlsplit(args.url)
    if address.scheme != "http" or address.hostname not in {"127.0.0.1", "localhost", "::1"} or address.username or address.password:
        parser.error("P0 generation requires a local HTTP Runtime address without embedded credentials")
    report = None
    try:
        inputs, manifest, graph, run_id = prepare(args)
        report = dict(schema_version=1, operation="Generate", status="prepared", run_id=run_id,
                      evidence_kind=args.evidence_kind, run_kind=args.run_kind, p0_passed=False, progress=None,
                      started_at=datetime.now(timezone.utc).isoformat(),
                      provenance=dict(workflow=dict(id=manifest["id"], version=manifest["version"], manifest_sha256=sha256(WORKFLOW / "manifest.json"),
                                                    definition_sha256=sha256(WORKFLOW / "workflow.json")),
                                      input_sha256=sha256(args.input), request_sha256=sha256(args.output_dir / "request.json"),
                                      input_values={field: inputs[field] for field in manifest["input_mapping"]},
                                      tool=tool_provenance(),
                                      settings=graph[manifest["settings_node"]]["inputs"]))
        if args.oom_comparison:
            report["oom_comparison"] = args.oom_comparison
        event(args.output_dir, "prepared", run_id=run_id, evidence_kind=args.evidence_kind)
        if args.command == "run":
            run_generation(args, inputs, manifest, graph, run_id, report)
        report["finished_at"] = datetime.now(timezone.utc).isoformat()
        event(args.output_dir, report["status"], run_id=run_id)
        write_json(args.output_dir / "report.json", report)
        print(json.dumps({"status": report["status"], "output_dir": str(args.output_dir), "p0_passed": False}))
        return 0
    except (OSError, ValueError, KeyError, subprocess.SubprocessError, RuntimeFailure, GenerationFailure) as error:
        if report is not None:
            report["status"] = "failed"
            report["error"] = failure_record(error)
            report["finished_at"] = datetime.now(timezone.utc).isoformat()
            event(args.output_dir, "failed", error=report["error"], prompt_id=report.get("prompt_id"))
            if isinstance(getattr(error, "details", None), dict) and "status" in error.details:
                write_json(args.output_dir / "history.json", error.details)
            write_json(args.output_dir / "report.json", report)
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
