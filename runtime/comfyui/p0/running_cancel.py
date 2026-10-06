"""P0 exact-owned running cancellation; dispatch is never terminal proof."""

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
import time
import uuid
from urllib.parse import quote, urlsplit

from runtime_client import RuntimeClient, RuntimeFailure
from queue_history import interval, queue, validate_result
from generation import GenerationFailure, validate_schema
from transcribe import readiness


PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parents[1]
GENERATION = ROOT / "workflows" / "generate"
SEEDS = {"A": 2026101801, "B": 2026101802}


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def sha256(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def owned_job(mapping, label):
    if (not isinstance(mapping, dict) or mapping.get("schema_version") != 1
            or not isinstance(mapping.get("run_id"), str) or not mapping["run_id"]
            or not isinstance(mapping.get("jobs"), dict)):
        raise ValueError("Cancellation requires a valid saved schema=1 run mapping")
    job = mapping["jobs"].get(label)
    if (not isinstance(job, dict) or not isinstance(job.get("prompt_id"), str) or not job["prompt_id"]
            or job.get("client_id") != mapping["run_id"] + ":" + label or not isinstance(job.get("graph"), dict)):
        raise ValueError("Cancellation target lacks an owned run/client/prompt/graph mapping")
    if sum(other.get("prompt_id") == job["prompt_id"] for other in mapping["jobs"].values()
           if isinstance(other, dict)) != 1:
        raise ValueError("Cancellation prompt id is ambiguous in the saved mapping")
    return job


def check_row(row, job):
    if row[1] != job["prompt_id"] or row[2] != job["graph"] or row[3].get("client_id") != job["client_id"]:
        raise RuntimeFailure("/queue", "Target prompt/client/graph differs from saved ownership; no cancellation sent.", details=row)


def check_history(entry, job):
    row = entry.get("prompt")
    if not isinstance(row, list) or len(row) < 4 or not isinstance(row[3], dict):
        raise RuntimeFailure("/history", "Terminal history cannot establish target ownership.", details=entry)
    if row[1] != job["prompt_id"] or row[2] != job["graph"] or row[3].get("client_id") != job["client_id"]:
        raise RuntimeFailure("/history", "Terminal prompt/client/graph differs from saved ownership.", details=entry)


def terminal_result(client, job, entry, result):
    check_history(entry, job)
    normalized = client.get_json("/api/jobs/" + quote(job["prompt_id"], safe=""))
    result.update(history=entry, normalized=normalized)
    status = entry.get("status", {})
    interrupted = any(isinstance(message, list) and len(message) == 2 and message[0] == "execution_interrupted"
                      and isinstance(message[1], dict) and message[1].get("prompt_id") == job["prompt_id"]
                      for message in status.get("messages", []))
    if status.get("status_str") == "error" and interrupted and normalized.get("id") == job["prompt_id"] and normalized.get("status") == "cancelled":
        result.update(outcome="cancelled", terminal_confirmed=True)
    elif status.get("status_str") == "success" and status.get("completed") is True:
        result["outcome"] = "completed"
    elif status.get("status_str") == "error":
        result["outcome"] = "failed"
    else:
        raise RuntimeFailure("/history", "History has no recognized terminal result; cancellation remains unconfirmed.", details=entry)
    return result


class LogCursor:
    def __init__(self, path, output):
        self.path, self.output = path, output
        stat = path.stat()
        self.identity = (stat.st_dev, stat.st_ino)
        self.start = self.offset = stat.st_size
        self.tail = b""

    def read(self):
        with self.path.open("rb") as handle:
            stat = self.path.stat()
            if (stat.st_dev, stat.st_ino) != self.identity or stat.st_size < self.offset:
                raise ValueError("Runtime log identity changed or file was truncated; phase attribution is rejected")
            handle.seek(self.offset)
            chunk = handle.read()
            after = self.path.stat()
            if (after.st_dev, after.st_ino) != self.identity or after.st_size < self.offset + len(chunk):
                raise ValueError("Runtime log identity changed or file was truncated during read")
        self.offset += len(chunk)
        with self.output.open("ab") as evidence:
            evidence.write(chunk)
        text = self.tail + chunk
        self.tail = text[-64:]
        return b"Writing the score" in text

    def facts(self):
        return dict(path=str(self.path.resolve()), device=self.identity[0], inode=self.identity[1],
                    start_byte=self.start, end_byte=self.offset, evidence=str(self.output))


def require_current(client, job):
    state = queue(client)
    if len(state["queue_running"]) != 1 or state["queue_pending"]:
        raise RuntimeFailure("/queue", "Score marker needs one exclusively owned running request and no pending work.", details=state)
    check_row(state["queue_running"][0], job)
    return state


def observe_score(client, mapping, label, cursor, timeout, poll_interval, result):
    job = owned_job(mapping, label)
    deadline = time.monotonic() + timeout
    while True:
        state = queue(client)
        if not state["queue_running"]:
            if state["queue_pending"]:
                if len(state["queue_pending"]) != 1:
                    raise RuntimeFailure("/queue", "Foreign work appeared before the owned score phase.", details=state)
                check_row(state["queue_pending"][0], job)
            elif client.history(job["prompt_id"]) is not None:
                raise RuntimeFailure("/history", "Target finished before a new owned score marker; no cancellation sent.")
        else:
            before = require_current(client, job)
            marker = cursor.read()
            after = require_current(client, job)
            result.update(log=cursor.facts(), before=before, after=after, marker_observed=marker)
            if marker:
                return result
        if time.monotonic() >= deadline:
            raise RuntimeFailure("/queue", "No new same-run score marker was confirmed before the deadline; no cancellation sent.")
        time.sleep(min(poll_interval, max(0, deadline - time.monotonic())))


def cancel_running(client, mapping, label, timeout, poll_interval, result):
    job = owned_job(mapping, label)
    result.update(target_label=label, prompt_id=job["prompt_id"], client_id=job["client_id"],
                  cancel_attempted=False, terminal_confirmed=False)
    entry = client.history(job["prompt_id"])
    if entry is not None:
        terminal_result(client, job, entry, result)
        result["guard"] = "terminal_no_write"
        return result
    state = queue(client)
    result["before"] = state
    current = next((row for row in state["queue_running"] if row[1] == job["prompt_id"]), None)
    if current is None:
        result["outcome"] = "not_current_no_write"
        result["after"] = queue(client)
        entry = client.history(job["prompt_id"])
        if entry is not None:
            terminal_result(client, job, entry, result)
        return result
    check_row(current, job)
    result["cancel_attempted"] = True
    reply = client.post_json("/api/jobs/" + quote(job["prompt_id"], safe="") + "/cancel", {})
    result["dispatch"] = reply
    if type(reply.get("cancelled")) is not bool:
        raise RuntimeFailure("/api/jobs/cancel", "Native response has no cancellation dispatch boolean.", details=reply)
    deadline = time.monotonic() + timeout
    while True:
        entry = client.history(job["prompt_id"])
        result["after"] = queue(client)
        if entry is not None:
            return terminal_result(client, job, entry, result)
        if reply["cancelled"] is False:
            result["outcome"] = "not_dispatched"
            return result
        if time.monotonic() >= deadline:
            raise RuntimeFailure("/history", "Dispatch was observed but terminal cancellation was not confirmed within the deadline; preserve mapping and query before recovery.")
        time.sleep(min(poll_interval, max(0, deadline - time.monotonic())))


def snapshot(client, mapping, output, stage):
    state = queue(client)
    jobs = {job["prompt_id"]: job for job in mapping["jobs"].values()}
    for row in state["queue_running"] + state["queue_pending"]:
        if row[1] not in jobs:
            raise RuntimeFailure("/queue", "Foreign request appeared during the exclusive cancellation demo.", details=state)
        check_row(row, jobs[row[1]])
    with (output / "queue-events.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dict(at=datetime.now(timezone.utc).isoformat(), stage=stage, queue=state)) + "\n")
    return state


def wait_running(client, mapping, label, args):
    job = owned_job(mapping, label)
    deadline = time.monotonic() + args.timeout
    while True:
        state = snapshot(client, mapping, args.output_dir, "wait_" + label)
        if state["queue_running"]:
            return require_current(client, job)
        if client.history(job["prompt_id"]) is not None:
            raise RuntimeFailure("/history", "Successor finished before the controlled stale-target probe; do not claim that boundary was tested.")
        if time.monotonic() >= deadline:
            raise RuntimeFailure("/queue", "Timed out waiting for the owned successor to run; no further request submitted.")
        time.sleep(min(args.poll_interval, max(0, deadline - time.monotonic())))


def controlled_terminal_noop(client, mapping, args):
    """Deliberate stale owned-id native probe, separate from the safe cancel guard."""
    a, b = owned_job(mapping, "A"), owned_job(mapping, "B")
    entry = client.history(a["prompt_id"])
    if entry is None:
        raise RuntimeFailure("/history", "Stale-target probe requires A's saved terminal history.")
    final = terminal_result(client, a, entry, dict(terminal_confirmed=False))
    if final["outcome"] != "cancelled":
        raise RuntimeFailure("/history", "Stale-target probe requires confirmed cancelled A.", details=final)
    before = require_current(client, b)
    reply = client.post_json("/api/jobs/" + quote(a["prompt_id"], safe="") + "/cancel", {})
    after = snapshot(client, mapping, args.output_dir, "stale_A_probe")
    result = dict(target_prompt_id=a["prompt_id"], current_prompt_id=b["prompt_id"], before=before, dispatch=reply, after=after)
    if reply.get("cancelled") is not False:
        raise RuntimeFailure("/api/jobs/cancel", "Stale owned terminal target did not return native dispatch=false.", details=result)
    return result


def run_demo(args, report):
    if args.doctor_report is None or args.runtime_log is None:
        raise ValueError("run requires --doctor-report and the owned server's --runtime-log")
    config = read_json(PROJECT / "runtime.json")
    models = {model["id"]: model for model in read_json(PROJECT / "models.json")["models"]}
    prior = readiness(args.doctor_report, config, models["yue2-bf16"])
    client = RuntimeClient(args.url)
    initial = queue(client)
    report["initial_queue"] = initial
    if initial["queue_running"] or initial["queue_pending"]:
        raise RuntimeFailure("/queue", "Runtime must be idle before the exclusive running-cancel demo.", details=initial)
    observed = client.get_json("/system_stats")
    system = observed.get("system", {})
    if system.get("pytorch_version") != config["torch"] or str(system.get("python_version", "")).split(" ")[0] != config["python"]:
        raise RuntimeFailure("/system_stats", "Live Runtime does not match the pinned Python/Torch.", details=observed)
    run_id = uuid.uuid4().hex
    mapping = dict(schema_version=1, run_id=run_id, jobs={})
    report.update(run_id=run_id, mapping=mapping, resource_snapshots={"before": observed},
                  resource_scope="Point-in-time native /system_stats; no peak or per-process GPU/RAM claim",
                  provenance=dict(readiness=prior, runtime=config, model=models["yue2-bf16"], seeds=SEEDS,
                                  source_sha256={name: sha256(Path(__file__).parent / name) for name in
                                                 ["running_cancel.py", "queue_history.py", "runtime_client.py", "generation.py", "score_validation.py", "transcribe.py"]},
                                  workflow_sha256={name: sha256(GENERATION / name) for name in ["workflow.json", "manifest.json", "input.json"]}))
    report["preserved_artifacts"] = [dict(path=str(path.resolve()), before_sha256=sha256(path)) for path in args.preserve_artifact]
    manifest, template, inputs = [read_json(GENERATION / name) for name in ["manifest.json", "workflow.json", "input.json"]]
    info = client.get_json("/object_info")
    cursor = LogCursor(args.runtime_log, args.output_dir / "runtime-log.txt")
    report["log"] = cursor.facts()

    def submit(label):
        folder = args.output_dir / label
        folder.mkdir()
        graph = deepcopy(template)
        for field, location in manifest["input_mapping"].items():
            graph[location["node"]]["inputs"][location["input"]] = SEEDS[label] if field == "seed" else inputs[field]
        graph[manifest["output_mapping"]["audio"]["node"]]["inputs"]["filename_prefix"] = "p0/running-cancel/" + run_id + "/" + label
        validate_schema(info, graph)
        job = dict(client_id=run_id + ":" + label, graph=graph, manifest=manifest, operation="Generate")
        write_json(folder / "request.json", dict(prompt=graph, client_id=job["client_id"]))
        report["submission_attempt"] = dict(label=label, request=str(folder / "request.json"), response_received=False)
        job["prompt_id"] = client.submit(graph, job["client_id"])
        mapping["jobs"][label] = job
        write_json(args.output_dir / "run-map.json", mapping)
        report["submission_attempt"]["response_received"] = True
        return job

    submit("A")
    report["score_trigger"] = {}
    observe_score(client, mapping, "A", cursor, args.timeout, args.poll_interval, report["score_trigger"])
    report["resource_snapshots"]["score_trigger"] = client.get_json("/system_stats")
    cancel_running(client, mapping, "A", args.timeout, args.poll_interval, report["cancellation"])
    write_json(args.output_dir / "A" / "cancellation.json", report["cancellation"])
    if not report["cancellation"]["terminal_confirmed"]:
        raise RuntimeFailure("/history", "A's actual final result is not confirmed cancellation; B is not submitted.", details=report["cancellation"])
    write_json(args.output_dir / "A" / "history.json", report["cancellation"]["history"])
    post_a = snapshot(client, mapping, args.output_dir, "A_cancelled")
    if post_a["queue_running"] or post_a["queue_pending"]:
        raise RuntimeFailure("/queue", "Runtime was not idle after A cancellation; B is not submitted.", details=post_a)
    report["resource_snapshots"]["post_cancel_pre_B"] = client.get_json("/system_stats")
    b = submit("B")
    wait_running(client, mapping, "B", args)
    report["terminal_guard"] = {}
    cancel_running(client, mapping, "A", args.timeout, args.poll_interval, report["terminal_guard"])
    if report["terminal_guard"]["cancel_attempted"]:
        raise RuntimeFailure("/api/jobs/cancel", "Ordinary terminal guard unexpectedly sent a cancellation.")
    report["controlled_native_noops"] = []
    for _ in range(2):
        report["controlled_native_noops"].append(controlled_terminal_noop(client, mapping, args))
    deadline = time.monotonic() + args.timeout
    while True:
        state = snapshot(client, mapping, args.output_dir, "observing_B")
        entry = client.history(b["prompt_id"])
        if entry is not None and not state["queue_running"] and not state["queue_pending"]:
            break
        if time.monotonic() >= deadline:
            raise RuntimeFailure("/history", "Successor did not reach history and idle queue before the deadline; preserve the owned map.")
        time.sleep(min(args.poll_interval, max(0, deadline - time.monotonic())))
    check_history(entry, b)
    write_json(args.output_dir / "B" / "history.json", entry)
    report["successor_interval"] = interval(entry, b["prompt_id"])
    report["successor_outputs"] = validate_result(client, b, entry, args.output_dir / "B")
    report["final_queue"] = snapshot(client, mapping, args.output_dir, "final")
    if report["final_queue"]["queue_running"] or report["final_queue"]["queue_pending"]:
        raise RuntimeFailure("/queue", "Final queue is no longer idle.", details=report["final_queue"])
    report["resource_snapshots"]["post_B"] = client.get_json("/system_stats")
    for artifact in report["preserved_artifacts"]:
        artifact["after_sha256"] = sha256(Path(artifact["path"]))
        artifact["unchanged"] = artifact["after_sha256"] == artifact["before_sha256"]
        if not artifact["unchanged"]:
            raise ValueError("A declared existing artifact changed during cancellation")
    cursor.read()
    report["log"] = cursor.facts()
    report.update(status="completed", verified=True, concurrency=1,
                  proof_scope="Owned A interrupted and normalized cancelled; repeated stale owned A native calls dispatch false while B was current; B then succeeded with validated outputs and final idle queue")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["run", "cancel-running", "observe-score"])
    parser.add_argument("--run-map", type=Path)
    parser.add_argument("--target", default="A")
    parser.add_argument("--runtime-log", type=Path)
    parser.add_argument("--doctor-report", type=Path)
    parser.add_argument("--preserve-artifact", type=Path, action="append", default=[])
    parser.add_argument("--url", default="http://127.0.0.1:8188")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--evidence-kind", choices=["real", "fake"], default="real")
    parser.add_argument("--timeout", type=float, default=1800)
    parser.add_argument("--poll-interval", type=float, default=0.2)
    args = parser.parse_args()
    if any(not math.isfinite(value) or value <= 0 for value in [args.timeout, args.poll_interval]):
        parser.error("timeout and poll interval must be finite and positive")
    address = urlsplit(args.url)
    if (address.scheme != "http" or address.hostname not in {"127.0.0.1", "localhost", "::1"}
            or address.username or address.password or address.query or address.fragment):
        parser.error("Cancellation requires a local HTTP Runtime without embedded credentials")
    if args.output_dir.exists() and (not args.output_dir.is_dir() or any(args.output_dir.iterdir())):
        parser.error("output directory must be absent or empty")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    report = dict(schema_version=1, checked_at=datetime.now(timezone.utc).isoformat(), evidence_kind=args.evidence_kind,
                  p0_passed=False, verified=False, status="unconfirmed", cancellation={})
    try:
        if args.command == "run":
            run_demo(args, report)
        elif args.command == "observe-score":
            if args.run_map is None:
                raise ValueError("observe-score requires --run-map")
            mapping = read_json(args.run_map)
            report["mapping"] = mapping
            if args.runtime_log is None:
                raise ValueError("observe-score requires --runtime-log")
            report["observation"] = {}
            cursor = LogCursor(args.runtime_log, args.output_dir / "runtime-log.txt")
            observe_score(RuntimeClient(args.url), mapping, args.target, cursor, args.timeout, args.poll_interval, report["observation"])
            report["status"] = "score_marker_observed"
        else:
            if args.run_map is None:
                raise ValueError("cancel-running requires --run-map")
            mapping = read_json(args.run_map)
            report["mapping"] = mapping
            cancel_running(RuntimeClient(args.url), mapping, args.target, args.timeout, args.poll_interval, report["cancellation"])
            report["status"] = report["cancellation"]["outcome"]
            report["verified"] = report["cancellation"]["terminal_confirmed"]
        code = 0 if report["status"] not in ["failed", "not_dispatched"] else 1
    except (ValueError, OSError, RuntimeFailure, GenerationFailure) as error:
        report.update(status="failed", error=dict(message=str(error), details=getattr(error, "details", None)))
        code = 1
    write_json(args.output_dir / "report.json", report)
    print(json.dumps(dict(status=report["status"], verified=report["verified"], report=str(args.output_dir / "report.json"))))
    return code


if __name__ == "__main__":
    sys.exit(main())
