"""Validate one fixed short Reference Audio through the public Runtime API."""

import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
import time
import uuid
import wave

from runtime_client import RuntimeClient, RuntimeFailure
from reference_fixture import write_reference
from score_validation import validate_abc


PROJECT = Path(__file__).resolve().parents[1]
WORKFLOW = PROJECT / "workflows" / "transcribe-sheetsage2" / "v1"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=True), encoding="utf-8")


def readiness(path, runtime, model):
    document = json.loads(path.read_text(encoding="utf-8-sig"))
    report = document.get("report", document)
    if report.get("ready") is not True:
        raise ValueError("Readiness receipt is not ready; complete Runtime Doctor before transcription.")
    checks = {check["id"]: check for check in report.get("checks", [])}
    for name in ["comfyui", "plugin"]:
        check = checks.get(name, {})
        if check.get("status") != "passed" or check.get("facts", {}).get("revision") != runtime["sources"][name]["revision"]:
            raise ValueError(f"Readiness receipt does not verify the pinned {name} revision.")
    check = checks.get("model:" + model["id"], {})
    facts = check.get("facts", {})
    if check.get("status") != "passed" or facts.get("state") != "ready" or facts.get("revision") != model["revision"] or facts.get("actual_sha256") != model["sha256"]:
        raise ValueError("Readiness receipt does not verify the pinned SheetSage2 model hash.")
    return dict(path=str(path.resolve()), sha256=digest(path), checked_at=report.get("checked_at", "unavailable"),
                verification_scope=report.get("verification_scope", "unavailable"), verified_checks=checks)


def runtime_seconds(history):
    stamps = {name: data.get("timestamp") for name, data in history.get("status", {}).get("messages", [])
              if isinstance(data, dict) and name in ["execution_start", "execution_success"]}
    start, end = stamps.get("execution_start"), stamps.get("execution_success")
    if isinstance(start, (int, float)) and isinstance(end, (int, float)) and end >= start:
        return dict(state="observed", seconds=(end - start) / 1000, scope="Runtime execution_start to execution_success, including cache/overhead")
    return dict(state="unavailable", reason="History has no comparable execution timestamps")


def transcribe(args, receipt):
    manifest = json.loads((WORKFLOW / "manifest.json").read_text(encoding="utf-8"))
    graph = json.loads((WORKFLOW / "workflow.json").read_text(encoding="utf-8"))
    fixture = json.loads((WORKFLOW / "fixture.json").read_text(encoding="utf-8"))
    runtime = json.loads((PROJECT / "runtime.json").read_text(encoding="utf-8"))
    model = next(model for model in json.loads((PROJECT / "models.json").read_text(encoding="utf-8"))["models"]
                 if model["id"] == "sheetsage2-bf16")
    source = args.input or write_reference(args.output_dir / "reference.wav")
    receipt["input"] = inspect_audio(source)
    if args.input is None:
        if receipt["input"]["sha256"] != fixture["sha256"]:
            raise ValueError("Generated fixture hash differs from the versioned manifest; inspect generator/platform before submitting.")
        receipt["input"].update(fixture=fixture, generator_sha256=digest(Path(__file__).parent / "reference_fixture.py"))
    else:
        receipt["input"].update(source="Caller-supplied Reference Audio", license=args.input_license)
    prior = readiness(args.readiness_report, runtime, model)
    receipt["provenance"] = dict(readiness=prior, runtime=runtime["sources"]["comfyui"], plugin=runtime["sources"]["plugin"],
                                 model=model, workflow=dict(manifest, sha256=digest(WORKFLOW / "workflow.json"),
                                                           manifest_sha256=digest(WORKFLOW / "manifest.json")))
    client = RuntimeClient(args.base_url)
    stats = client.get_json("/system_stats")
    system = stats.get("system", {})
    if system.get("pytorch_version") != runtime["torch"] or not str(system.get("python_version", "")).startswith(runtime["python"]) or system.get("comfyui_version") != manifest["runtime_baseline"]["comfyui_version"]:
        raise RuntimeFailure("/system_stats", "Live Runtime ComfyUI/Python/Torch differs from the pinned environment.", details=stats)
    receipt["provenance"]["live_runtime"] = system
    available = client.get_json("/object_info")
    missing = sorted(set(manifest["required_nodes"]) - set(available))
    if missing:
        raise RuntimeFailure("/object_info", "Missing workflow nodes: " + ", ".join(missing))
    queue = client.get_json("/queue")
    if queue.get("queue_running") != [] or queue.get("queue_pending") != []:
        raise RuntimeFailure("/queue", "Runtime is busy or queue response is incomplete; GPU resource owner must serialize this run.", details=queue)
    receipt["system_stats_before"] = stats
    uploaded = client.upload(source, "p0/transcription/" + receipt["run_id"])
    mapping = manifest["input_mapping"]["reference_audio"]
    graph[mapping["node"]]["inputs"][mapping["input"]] = "/".join(filter(None, [uploaded.get("subfolder", ""), uploaded["name"]]))
    receipt["settings"] = {node["class_type"]: node["inputs"] for node in graph.values() if node["class_type"] in ["YuE2Options", "YuE2Transcribe"]}
    request = dict(prompt=graph, client_id=receipt["run_id"])
    save_json(args.output_dir / "request.json", request)
    receipt["status"] = "submitted"
    started = time.monotonic()
    receipt["prompt_id"] = client.submit(graph, receipt["run_id"])
    save_json(args.output_dir / "receipt.json", receipt)
    history = client.wait(receipt["prompt_id"], args.timeout, args.poll_interval)
    save_json(args.output_dir / "history.json", history)
    cached = [data for name, data in history.get("status", {}).get("messages", []) if name == "execution_cached" and isinstance(data, dict)]
    if any(manifest["execution_node"] in event.get("nodes", []) for event in cached):
        raise RuntimeFailure("/history", "Transcription node was served from Runtime cache; this run cannot verify fresh GPU inference.", details=history)
    mapping = manifest["output_mapping"]["abc"]
    values = history.get("outputs", {}).get(mapping["node"], {}).get(mapping["field"])
    if not isinstance(values, list) or len(values) <= mapping["index"]:
        raise RuntimeFailure("/history", "Successful history contains no mapped ABC output.", details=history)
    abc = values[mapping["index"]]
    abc_validation = validate_abc(client, abc)
    midi_reply = client.post_json(manifest["validation_routes"]["midi_export"], {"abc": abc})
    midi = base64.b64decode(midi_reply.get("data", ""), validate=True)
    if len(midi) < 14 or midi[:4] != b"MThd":
        raise RuntimeFailure("/yue2/score/midi", "MIDI export returned no Standard MIDI file.")
    candidate = args.output_dir / "candidate.mid"
    candidate.write_bytes(midi)
    uploaded_midi = client.upload(candidate, "p0/transcription/" + receipt["run_id"])
    midi_name = "/".join(filter(None, [uploaded_midi.get("subfolder", ""), uploaded_midi["name"]]))
    midi_validation = client.post_json(manifest["validation_routes"]["midi_read"], {"name": midi_name, "mode": "melody"})
    note_count = sum(part.get("notes", 0) for part in midi_validation.get("parts", []) if isinstance(part, dict))
    if note_count < 1:
        raise RuntimeFailure("/yue2/midi/tracks", "Exported MIDI contains no readable notes.", details=midi_validation)
    receipt["validation"] = dict(abc=abc_validation, midi=dict(parser=manifest["validation_routes"]["midi_read"],
                                                             valid=True, note_count=note_count, response=midi_validation))
    (args.output_dir / "score.abc").write_text(abc, encoding="utf-8")
    candidate.replace(args.output_dir / "score.mid")
    receipt["outputs"] = {name: dict(path=str((args.output_dir / name).resolve()), sha256=digest(args.output_dir / name)) for name in ["score.abc", "score.mid"]}
    receipt["metrics"] = dict(client_elapsed_seconds=time.monotonic() - started, runtime_event_time=runtime_seconds(history),
                             peak_vram=dict(state="unavailable", reason="Only before/after public snapshots observed"),
                             peak_ram=dict(state="unavailable", reason="No process memory sampler attached"),
                             phase_times=dict(state="unavailable", reason="History does not expose reliable individual phase timings"),
                             plugin_result_cache=dict(state="unavailable", reason="SheetSage2 keeps an independent result cache that public history does not expose; root must attach first-run progress/GPU evidence"))
    try:
        receipt["system_stats_after"] = client.get_json("/system_stats")
    except RuntimeFailure as error:
        receipt["system_stats_after"] = dict(state="unavailable", reason=str(error))
    receipt.update(status="completed", verified=True)


def inspect_audio(path):
    try:
        with wave.open(str(path), "rb") as audio:
            facts = dict(sample_rate=audio.getframerate(), channels=audio.getnchannels(),
                         sample_width=audio.getsampwidth(), frames=audio.getnframes())
            data = audio.readframes(facts["frames"])
    except (OSError, EOFError, wave.Error) as error:
        raise ValueError(f"Input must be a readable PCM WAV: {error}") from error
    if facts["sample_rate"] <= 0:
        raise ValueError("Input WAV sample rate must be positive.")
    facts["duration_seconds"] = facts["frames"] / facts["sample_rate"]
    if facts["sample_width"] != 2 or facts["channels"] not in (1, 2) or not 0.05 <= facts["duration_seconds"] <= 30:
        raise ValueError("P0 input must be 16-bit mono/stereo PCM WAV, from 0.05 to 30 seconds.")
    if len(data) != facts["frames"] * facts["channels"] * facts["sample_width"] or not any(data):
        raise ValueError("Input WAV is truncated or silent; use the fixed musical fixture.")
    facts.update(path=str(path.resolve()), sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    return facts


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Use an existing short PCM WAV instead of the original fixed fixture")
    parser.add_argument("--input-license", default="unknown; caller must record lawful source")
    parser.add_argument("--readiness-report", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8188")
    parser.add_argument("--timeout", type=float, default=1800)
    parser.add_argument("--poll-interval", type=float, default=1)
    args = parser.parse_args()
    if not math.isfinite(args.timeout) or not math.isfinite(args.poll_interval) or args.timeout <= 0 or args.poll_interval <= 0:
        parser.error("Timeout and poll interval must be finite positive numbers.")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if any(args.output_dir.iterdir()):
        print(json.dumps({"error": "Output directory is not empty; select a new run directory to preserve existing evidence."}))
        return 2
    receipt = dict(schema_version=1, operation="Transcribe", run_id=uuid.uuid4().hex,
                   status="failed", verified=False, p0_passed=False,
                   verification_scope="single Runtime API transcription and artifact validity; GPU execution requires external PM evidence",
                   started_at=datetime.now(timezone.utc).isoformat())
    try:
        transcribe(args, receipt)
    except (OSError, ValueError, RuntimeFailure) as error:
        receipt.update(status="failed", verified=False)
        receipt["error"] = str(error)
        if isinstance(error, RuntimeFailure) and error.details is not None:
            receipt["error_details"] = error.details
            save_json(args.output_dir / "failure-response.json", error.details)
            if error.endpoint == "/history" and isinstance(error.details, dict) and "status" in error.details:
                save_json(args.output_dir / "history.json", error.details)
    receipt["finished_at"] = datetime.now(timezone.utc).isoformat()
    save_json(args.output_dir / "receipt.json", receipt)
    print(json.dumps(receipt, indent=2))
    return 0 if receipt["verified"] else 1


if __name__ == "__main__":
    sys.exit(main())
