"""P0 owned queue/history and queued-only cancellation verification."""

import argparse
import base64
from copy import deepcopy
from datetime import datetime, timezone
import json
import hashlib
import math
from pathlib import Path
import sys
import time
import uuid
from urllib.parse import urlsplit

from runtime_client import RuntimeClient, RuntimeFailure
from generation import decode_audio, GenerationFailure, validate_schema
from queue_fixture import write_queue_reference
from score_validation import validate_abc
from transcribe import readiness


PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parents[1]
GENERATION = ROOT / "workflows" / "generate"
TRANSCRIPTION = PROJECT / "workflows" / "transcribe-sheetsage2" / "v1"
SEEDS = {"A": 2026101701, "C": 2026101702, "D": 2026101703}


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=True), encoding="utf-8")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def queue(client):
    state = client.get_json("/queue")
    for key in ["queue_running", "queue_pending"]:
        if not isinstance(state.get(key), list) or any(not isinstance(row, list) or len(row) < 4
                                                     or not isinstance(row[1], str) or not isinstance(row[3], dict)
                                                     for row in state[key]):
            raise RuntimeFailure("/queue", "Queue response cannot establish task identities.", details=state)
    if len(state["queue_running"]) > 1:
        raise RuntimeFailure("/queue", "Observed more than one running request; concurrency=1 is not established.", details=state)
    return state


def cancel_owned_queued(client, mapping, label):
    if not isinstance(mapping, dict) or not isinstance(mapping.get("jobs"), dict):
        raise RuntimeFailure("/queue", "Cancellation has no valid saved run mapping.")
    target = mapping["jobs"].get(label)
    if (mapping.get("schema_version") != 1 or not mapping.get("run_id") or not isinstance(target, dict)
            or not isinstance(target.get("prompt_id"), str) or not target.get("prompt_id")
            or target.get("client_id") != mapping["run_id"] + ":" + label):
        raise RuntimeFailure("/queue", "Cancellation target has no owned run-to-prompt mapping.")
    identifier = target["prompt_id"]
    if sum(job.get("prompt_id") == identifier for job in mapping["jobs"].values() if isinstance(job, dict)) != 1:
        raise RuntimeFailure("/queue", "Ambiguous prompt ownership in the saved run mapping; no deletion sent.")
    before = queue(client)
    history_before = client.history(identifier)
    result = dict(target_label=label, prompt_id=identifier, client_id=target["client_id"], before=before,
                  history_before=history_before, never_started_proven=False, delete_attempted=False)
    pending = next((row for row in before["queue_pending"] if row[1] == identifier), None)
    running = any(row[1] == identifier for row in before["queue_running"])
    if history_before is not None or running or pending is None:
        result["outcome"] = "history_present" if history_before is not None else "running_noop" if running else "not_pending"
        return result
    if pending[3].get("client_id") != target["client_id"]:
        raise RuntimeFailure("/queue", "Pending target ownership differs from the saved run mapping; no deletion sent.", details=before)
    response = client.post_json_bytes("/queue", {"delete": [identifier]})
    result.update(delete_attempted=True, response_bytes=len(response))
    after = queue(client)
    history_after = client.history(identifier)
    result.update(after=after, history_after=history_after)
    if history_after is not None or any(row[1] == identifier for row in after["queue_running"]):
        result["outcome"] = "moved_to_running_or_history"
    elif any(row[1] == identifier for row in after["queue_pending"]):
        result["outcome"] = "still_pending"
    else:
        result["outcome"] = "removed_pending"
    return result


def snapshot(client, output, mapping, stage):
    state = queue(client)
    owners = {job["prompt_id"]: job["client_id"] for job in mapping["jobs"].values() if job.get("prompt_id")}
    for row in state["queue_running"] + state["queue_pending"]:
        if row[1] not in owners or row[3].get("client_id") != owners[row[1]]:
            raise RuntimeFailure("/queue", "Foreign or incorrectly owned request appeared during the exclusive demo.", details=state)
    with (output / "queue-events.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dict(at=datetime.now(timezone.utc).isoformat(), stage=stage, queue=state)) + "\n")
    return state


def interval(entry, identifier):
    status = entry.get("status", {})
    if status.get("status_str") != "success" or status.get("completed") is not True:
        raise RuntimeFailure("/history", "A surviving request did not complete successfully.", details=entry)
    messages = status.get("messages", [])
    start = [data.get("timestamp") for name, data in messages if name == "execution_start" and data.get("prompt_id") == identifier]
    end = [data.get("timestamp") for name, data in messages if name == "execution_success" and data.get("prompt_id") == identifier]
    if len(start) != 1 or len(end) != 1 or any(type(value) not in (int, float) or not math.isfinite(value) for value in start + end) or end[0] <= start[0]:
        raise RuntimeFailure("/history", "History lacks unambiguous start/success timestamps for its owned request.", details=entry)
    return dict(start_ms=start[0], end_ms=end[0], seconds=(end[0] - start[0]) / 1000)


def validate_result(client, job, entry, output):
    manifest = job["manifest"]
    core = manifest["core_node"] if job["operation"] == "Generate" else manifest["execution_node"]
    if any(name == "execution_cached" and core in data.get("nodes", []) for name, data in entry["status"].get("messages", [])):
        raise RuntimeFailure("/history", "A surviving inference node was served from core cache.", details=entry)
    values = entry.get("outputs", {})
    if job["operation"] == "Generate":
        score_map, audio_map = manifest["output_mapping"]["score"], manifest["output_mapping"]["audio"]
        abc_values = values.get(score_map["node"], {}).get(score_map["key"])
        audio_values = values.get(audio_map["node"], {}).get(audio_map["key"])
        if not isinstance(abc_values, list) or not abc_values or not isinstance(audio_values, list) or not audio_values:
            raise RuntimeFailure("/history", "Generation history contains no mapped Score/audio outputs.", details=entry)
        abc, descriptor = abc_values[0], audio_values[0]
        if not isinstance(descriptor, dict):
            raise RuntimeFailure("/history", "Generation history contains no audio artifact.", details=entry)
        score = validate_abc(client, abc)
        suffix = Path(descriptor["filename"]).suffix.lower()
        if suffix not in [".wav", ".flac"]:
            raise RuntimeFailure("/view", "Generation artifact is not the pinned WAV/FLAC output.")
        audio = output / ("audio" + suffix)
        audio.write_bytes(client.artifact(descriptor))
        decoded = decode_audio(audio)
        bounds = manifest["audio_duration_seconds"]
        if not bounds["minimum"] <= decoded["duration_seconds"] <= bounds["maximum"]:
            raise RuntimeFailure("/view", "Generated audio duration is outside the verified 30–40 second budget.", details=decoded)
        (output / "score.abc").write_text(abc, encoding="utf-8")
        return dict(score=score, audio=decoded, audio_descriptor=descriptor, score_sha256=sha256(output / "score.abc"))
    mapping = manifest["output_mapping"]["abc"]
    abc_values = values.get(mapping["node"], {}).get(mapping["field"])
    if not isinstance(abc_values, list) or len(abc_values) <= mapping["index"]:
        raise RuntimeFailure("/history", "Transcription history contains no mapped Score output.", details=entry)
    abc = abc_values[mapping["index"]]
    score = validate_abc(client, abc)
    reply = client.post_json("/yue2/score/midi", {"abc": abc})
    midi = base64.b64decode(reply.get("data", ""), validate=True)
    if len(midi) < 14 or midi[:4] != b"MThd":
        raise RuntimeFailure("/yue2/score/midi", "No Standard MIDI artifact was returned.")
    target = output / "candidate.mid"
    target.write_bytes(midi)
    uploaded = client.upload(target, job["upload_subfolder"])
    name = "/".join(filter(None, [uploaded.get("subfolder", ""), uploaded["name"]]))
    parsed = client.post_json("/yue2/midi/tracks", {"name": name, "mode": "melody"})
    notes = sum(part.get("notes", 0) for part in parsed.get("parts", []))
    if notes < 1:
        raise RuntimeFailure("/yue2/midi/tracks", "Transcription MIDI has no readable notes.", details=parsed)
    target.replace(output / "score.mid")
    (output / "score.abc").write_text(abc, encoding="utf-8")
    return dict(score=score, midi=dict(parser="/yue2/midi/tracks", response=parsed, note_count=notes,
                                     sha256=sha256(output / "score.mid")), score_sha256=sha256(output / "score.abc"))


def run_demo(args, report):
    if args.doctor_report is None:
        raise ValueError("run requires --doctor-report from the actual successful prerequisite check")
    config = read_json(PROJECT / "runtime.json")
    registry = read_json(PROJECT / "models.json")
    models = {model["id"]: model for model in registry["models"]}
    prior = readiness(args.doctor_report, config, models["sheetsage2-bf16"])
    yue = prior["verified_checks"].get("model:yue2-bf16", {})
    if yue.get("status") != "passed" or yue.get("facts", {}).get("actual_sha256") != models["yue2-bf16"]["sha256"]:
        raise ValueError("Doctor receipt does not verify the required YuE2 model")
    client = RuntimeClient(args.url)
    initial = queue(client)
    write_json(args.output_dir / "queue-initial.json", initial)
    if initial["queue_running"] or initial["queue_pending"]:
        raise RuntimeFailure("/queue", "Runtime must be idle before this exclusive demo.", details=initial)
    observed = client.get_json("/system_stats")
    system = observed.get("system", {})
    if system.get("pytorch_version") != config["torch"] or str(system.get("python_version", "")).split(" ")[0] != config["python"]:
        raise RuntimeFailure("/system_stats", "Live Runtime does not match the pinned Python/Torch environment.", details=observed)
    run_id = uuid.uuid4().hex
    mapping = dict(schema_version=1, run_id=run_id, jobs={})
    report.update(run_id=run_id, plan_version="1", mapping=mapping,
                  provenance=dict(readiness=prior, models=models, runtime=config, system_stats=observed,
                                  source_sha256={name: sha256(Path(__file__).parent / name) for name in ["queue_history.py", "queue_fixture.py", "runtime_client.py", "reference_fixture.py", "generation.py", "score_validation.py", "transcribe.py"]},
                                  generation_input_sha256=sha256(GENERATION / "input.json")))
    fixture, variant = write_queue_reference(args.output_dir)
    if variant["sha256"] != "877fcbe4179be5f893d547c2947fd212ae50de97cde2724eead2474c5ad6f69f":
        raise ValueError("Queue fixture variant does not match its declared waveform hash")
    report["reference_audio"] = variant
    subfolder = "p0/queue-history/" + run_id
    uploaded = client.upload(fixture, subfolder)
    gen_manifest, gen_graph, inputs = [read_json(GENERATION / name) for name in ["manifest.json", "workflow.json", "input.json"]]
    trans_manifest, trans_graph = [read_json(TRANSCRIPTION / name) for name in ["manifest.json", "workflow.json"]]
    info = client.get_json("/object_info")
    for label in ["A", "B", "C", "D"]:
        operation = "Transcribe" if label == "B" else "Generate"
        graph, manifest = deepcopy(trans_graph if label == "B" else gen_graph), trans_manifest if label == "B" else gen_manifest
        if label == "B":
            field = manifest["input_mapping"]["reference_audio"]
            graph[field["node"]]["inputs"][field["input"]] = "/".join(filter(None, [uploaded.get("subfolder", ""), uploaded["name"]]))
        else:
            for field, field_map in manifest["input_mapping"].items():
                graph[field_map["node"]]["inputs"][field_map["input"]] = SEEDS[label] if field == "seed" else inputs[field]
            graph[manifest["output_mapping"]["audio"]["node"]]["inputs"]["filename_prefix"] = subfolder + "/" + label
        validate_schema(info, graph)
        destination = args.output_dir / label
        destination.mkdir()
        job = dict(operation=operation, client_id=run_id + ":" + label, manifest=manifest,
                   workflow_sha256=sha256((TRANSCRIPTION if label == "B" else GENERATION) / "workflow.json"),
                   request_sha256=None, upload_subfolder=subfolder, graph=graph)
        write_json(destination / "request.json", dict(prompt=graph, client_id=job["client_id"]))
        job["request_sha256"] = sha256(destination / "request.json")
        mapping["jobs"][label] = job
    for label, job in mapping["jobs"].items():
        job["prompt_id"] = client.submit(job["graph"], job["client_id"])
        write_json(args.output_dir / "run-map.json", mapping)
        snapshot(client, args.output_dir, mapping, "submitted_" + label)
    report["cancellation"] = cancel_owned_queued(client, mapping, "C")
    write_json(args.output_dir / "cancellation.json", report["cancellation"])
    deadline = time.monotonic() + args.timeout
    histories = {}
    while True:
        current = snapshot(client, args.output_dir, mapping, "observing")
        for label, job in mapping["jobs"].items():
            entry = client.history(job["prompt_id"])
            if entry is not None:
                histories[label] = entry
                write_json(args.output_dir / label / "history.json", entry)
        if all(label in histories for label in ["A", "B", "D"]) and not current["queue_running"] and not current["queue_pending"]:
            break
        if time.monotonic() >= deadline:
            raise RuntimeFailure("/queue", "Timed out observing owned work; inspect persisted mapping/queue/history before any retry. No interrupt is sent.")
        time.sleep(min(args.poll_interval, max(0, deadline - time.monotonic())))
    final_c = client.history(mapping["jobs"]["C"]["prompt_id"])
    report["final_queue"] = snapshot(client, args.output_dir, mapping, "final")
    if report["final_queue"]["queue_running"] or report["final_queue"]["queue_pending"]:
        raise RuntimeFailure("/queue", "Final queue did not remain idle; queued cancellation is not proven.", details=report["final_queue"])
    for label in ["A", "B", "D"]:
        job, prompt = mapping["jobs"][label], histories[label].get("prompt")
        if not isinstance(prompt, list) or len(prompt) < 4 or prompt[1] != job["prompt_id"] or prompt[2] != job["graph"] or prompt[3].get("client_id") != job["client_id"]:
            raise RuntimeFailure("/history", "Terminal history differs from its saved owned request.", details=histories[label])
    intervals = {label: interval(histories[label], mapping["jobs"][label]["prompt_id"]) for label in ["A", "B", "D"]}
    report["execution_intervals"] = intervals
    if intervals["B"]["start_ms"] < intervals["A"]["end_ms"] or intervals["D"]["start_ms"] < intervals["B"]["end_ms"]:
        raise RuntimeFailure("/history", "Observed execution intervals overlap or do not follow the surviving submission order.", details=intervals)
    report["outputs"] = {label: validate_result(client, mapping["jobs"][label], histories[label], args.output_dir / label) for label in ["A", "B", "D"]}
    if report["cancellation"]["outcome"] != "removed_pending" or final_c is not None or "C" in histories:
        raise RuntimeFailure("/queue", "Target was not proven cancelled while pending; preserve the race outcome without a never-started claim.", details=final_c)
    report["cancellation"].update(never_started_proven=True, final_history=final_c)
    report.update(status="completed", verified=True, concurrency=1,
                  proof_scope="Observed queue never has more than one running item; successful A/B/D native execution intervals are ordered and disjoint; C was pending before exact deletion, absent at final idle, and has no history")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["run", "cancel-queued"])
    parser.add_argument("--run-map", type=Path)
    parser.add_argument("--doctor-report", type=Path)
    parser.add_argument("--target", default="C")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--url", default="http://127.0.0.1:8188")
    parser.add_argument("--evidence-kind", choices=["real", "fake"], default="real")
    parser.add_argument("--timeout", type=float, default=1800)
    parser.add_argument("--poll-interval", type=float, default=0.2)
    args = parser.parse_args()
    if any(not math.isfinite(value) or value <= 0 for value in [args.timeout, args.poll_interval]):
        parser.error("Timeout and poll interval must be positive finite seconds")
    address = urlsplit(args.url)
    if address.scheme != "http" or address.hostname not in {"127.0.0.1", "localhost", "::1"} or address.username or address.password:
        parser.error("Queue verification requires a local HTTP Runtime without embedded credentials")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if any(args.output_dir.iterdir()):
        parser.error("Select an empty output directory; existing evidence is preserved")
    report = dict(schema_version=1, operation="QueueHistory", evidence_kind=args.evidence_kind,
                  status="failed", verified=False, p0_passed=False, started_at=datetime.now(timezone.utc).isoformat())
    try:
        if args.command == "cancel-queued":
            if args.run_map is None:
                raise ValueError("cancel-queued requires --run-map")
            mapping = json.loads(args.run_map.read_text(encoding="utf-8-sig"))
            report["cancellation"] = cancel_owned_queued(RuntimeClient(args.url), mapping, args.target)
            report["status"] = report["cancellation"]["outcome"]
        else:
            run_demo(args, report)
    except (OSError, ValueError, RuntimeFailure, GenerationFailure) as error:
        report["error"] = str(error)
        if isinstance(error, RuntimeFailure):
            report["error_details"] = error.details
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    write_json(args.output_dir / "report.json", report)
    print(json.dumps(report, indent=2))
    return 0 if report.get("verified") or report.get("status") == "removed_pending" else 1


if __name__ == "__main__":
    sys.exit(main())
