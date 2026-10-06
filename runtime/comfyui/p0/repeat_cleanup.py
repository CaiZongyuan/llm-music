"""Fixed P0 continuous repeat/cleanup protocol; final gate belongs to the PM."""

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import math
from pathlib import Path
import sys
import time
import uuid
from urllib.parse import urlsplit

from repeat_inputs import prepare, read_json, write_json, sha256, ledger, verify_plan
from repeat_observation import window, fingerprint, signal, trends
from repeat_report import render
from runtime_client import RuntimeClient, RuntimeFailure
from queue_history import queue, interval, validate_result
from generation import GenerationFailure, validate_schema
from metrics import MemorySampler, RuntimeLogs
from transcribe import readiness


PROJECT = Path(__file__).resolve().parents[1]


class Identity:
    def __init__(self, args):
        self.args = args
        self.initial = None
        if args.evidence_kind == "real":
            if args.process_pid is None or args.runtime_main is None:
                raise ValueError("Real series requires --process-pid and --runtime-main")
            self.initial = self.read()

    def read(self):
        if self.args.evidence_kind != "real":
            return dict(state="fake/unverified", pid=None, create_time=None)
        import psutil

        try:
            process = psutil.Process(self.args.process_pid)
            if not process.is_running() or not any(Path(arg).is_file() and Path(arg).samefile(self.args.runtime_main) for arg in process.cmdline()[1:]):
                raise ValueError("Runtime process identity does not execute the declared pinned main.py")
            value = dict(pid=process.pid, create_time=process.create_time(), state="observed")
        except psutil.Error as error:
            raise ValueError(f"Runtime process verification unavailable ({type(error).__name__}): {error}; "
                             "preserve the request mapping and inspect ownership before recovery; no further submissions or cleanup") from error
        if self.initial is not None and value != self.initial:
            raise ValueError("Runtime PID/create_time changed; continuous series stops")
        return value


def idle(client, identity, sampler, args):
    start = time.monotonic() - sampler.began
    deadline = time.monotonic() + args.idle_seconds
    sampler.take_sample()
    while True:
        identity.read()
        state = queue(client)
        if state["queue_running"] or state["queue_pending"]:
            raise RuntimeFailure("/queue", "Expected owned idle window; no further request is submitted.", details=state)
        if time.monotonic() >= deadline:
            break
        time.sleep(min(args.poll_interval, max(0, deadline - time.monotonic())))
    sampler.take_sample()
    end = time.monotonic() - sampler.began
    return window(sampler.snapshot(), start, end)


def wait_owned(client, identity, job, args):
    deadline = time.monotonic() + args.timeout
    while True:
        identity.read()
        state = queue(client)
        for row in state["queue_running"] + state["queue_pending"]:
            if row[1] != job["prompt_id"] or row[2] != job["graph"] or row[3].get("client_id") != job["client_id"]:
                raise RuntimeFailure("/queue", "Foreign/changed ownership appeared in the serial item.", details=state)
        history = client.history(job["prompt_id"])
        if history is not None:
            prompt = history.get("prompt")
            if not isinstance(prompt, list) or len(prompt) < 4 or prompt[1] != job["prompt_id"] or prompt[2] != job["graph"] or prompt[3].get("client_id") != job["client_id"]:
                raise RuntimeFailure("/history", "Terminal history does not match the saved request.", details=history)
            return history
        if time.monotonic() >= deadline:
            raise RuntimeFailure("/history", "Item timed out; preserve mapping and inspect before recovery. No retry/free/interrupt.")
        time.sleep(min(args.poll_interval, max(0, deadline - time.monotonic())))


def log_proof(job, history, receipt, directory):
    if not receipt["runtime_logs"] or not all(item["same_run_span"] for item in receipt["runtime_logs"]):
        raise ValueError("Same-item log continuity is unavailable; real workload remains unverified")
    text = "\n".join((directory / item["path"]).read_text(encoding="utf-8", errors="replace") for item in receipt["runtime_logs"])
    if job["operation"] == "Transcribe":
        mark = history.get("outputs", {}).get(job["core_node"], {}).get("yue2_track", [])
        if mark != [job["input"]["track_mark"]] or "Transcription reused" in text:
            raise ValueError("Decoded track mark differs or Sage result was reused; not fresh inference")
        required = ["loaded sheetsage2_bf16.safetensors on cuda:0", "Listening to the recording", "Writing down what it hears"]
    else:
        required = ["[yue2_comfy.loader] LM:", "resident on cuda:0", "[yue2_comfy] stages:", "[yue2_comfy.loader] unloaded"]
        if any(receipt["stage_seconds"][stage] is None for stage in ["planning_score", "generating_semantic", "synthesizing", "decoding_audio"]):
            raise ValueError("Generation stage summary is missing/ambiguous; no fresh workload claim")
    if any(marker not in text for marker in required):
        raise ValueError("Actual reload/phase log markers missing; no new workload is counted")
    return dict(verified=True, required_markers=required, receipt=receipt,
                model_load_exclusive_seconds=None, reason="Phase logs prove work; no invented exclusive load time")


def execute(job, client, identity, sampler, args, record, mapping, g5_graph=None):
    label = job["label"]
    target = args.output_dir / label
    target.mkdir()
    identity_before = identity.read()
    state = queue(client)
    if state["queue_running"] or state["queue_pending"]:
        raise RuntimeFailure("/queue", "Series is not idle; no next item submitted.", details=state)
    graph = deepcopy(g5_graph if g5_graph is not None else job["graph"])
    subfolder = "p0/repeat/" + record["run_id"]
    if job["operation"] == "Transcribe":
        source = args.prepared / job["input"]["file"]
        if sha256(source) != job["input"]["sha256"]:
            raise ValueError("Prepared audio bytes changed; no submission")
        uploaded = client.upload(source, subfolder)
        binding = job["manifest"]["input_mapping"]["reference_audio"]
        graph[binding["node"]]["inputs"][binding["input"]] = "/".join(filter(None, [uploaded.get("subfolder", ""), uploaded["name"]]))
    else:
        field = job["manifest"]["output_mapping"]["audio"]["node"]
        graph[field]["inputs"]["filename_prefix"] = subfolder + "/" + label
        if g5_graph is not None and fingerprint(graph, job["manifest"]) != fingerprint(g5_graph, job["manifest"]):
            raise ValueError("Cleanup G5 core/ancestors/IDs/bindings changed; reset witness is invalid")
    validate_schema(record["schema"], graph)
    runtime_job = dict(job, graph=graph, client_id=record["run_id"] + ":" + label, upload_subfolder=subfolder)
    item = dict(label=label, operation=job["operation"], role=job["role"], input=job["input"], status="unverified", identity_before=identity_before)
    record["items"].append(item)
    write_json(target / "request.json", dict(prompt=graph, client_id=runtime_job["client_id"]))
    logs = RuntimeLogs([args.runtime_log], target)
    begin = time.monotonic() - sampler.began
    sampler.take_sample()
    record["submission_attempt"] = dict(label=label, request_sha256=sha256(target / "request.json"), response_received=False)
    runtime_job["prompt_id"] = client.submit(graph, runtime_job["client_id"])
    mapping["jobs"][label] = runtime_job
    write_json(args.output_dir / "run-map.json", mapping)
    record["submission_attempt"]["response_received"] = True
    history = wait_owned(client, identity, runtime_job, args)
    terminal = time.monotonic() - sampler.began
    write_json(target / "history.json", history)
    timings = interval(history, runtime_job["prompt_id"])
    item["outputs"] = validate_result(client, runtime_job, history, target)
    item["core_uncached"] = True
    item["log_proof"] = log_proof(job, history, logs.finish(), target)
    denominator = job["input"]["duration_seconds"] if job["operation"] == "Transcribe" else item["outputs"]["audio"]["duration_seconds"]
    item["timing"] = dict(runtime_seconds=timings["seconds"], denominator_seconds=denominator, factor=timings["seconds"] / denominator,
                          factor_kind="transcription processing / Reference Audio" if job["operation"] == "Transcribe" else "generation RTF / actual decoded output",
                          scope="Native execution_start→execution_success including Workflow overhead, not exclusive model time")
    if job["operation"] == "Generate":
        audio = next(target.glob("audio.*"))
        item["outputs"]["signal"] = signal(audio)
        item["core_fingerprint"] = fingerprint(graph, job["manifest"])
    item["memory"] = dict(active=window(sampler.snapshot(), begin, terminal), idle=idle(client, identity, sampler, args))
    item.update(status="completed", identity_after=identity.read(), prompt_id=runtime_job["prompt_id"], request_sha256=sha256(target / "request.json"))
    write_json(target / "item.json", item)
    write_json(args.output_dir / "report.json", record)
    return graph


def run(args):
    if args.prepared is None or args.doctor_report is None or args.runtime_log is None:
        raise ValueError("run requires prepared inputs, successful Doctor receipt and owned Runtime stderr")
    plan = read_json(args.prepared / "plan.json")
    verify_plan(plan, args.prepared)
    fresh_ledger = ledger(args.ledger_root)
    if args.evidence_kind == "real" and args.ledger_root is None:
        raise ValueError("Real run requires retained actual --ledger-root")
    for job in plan["jobs"]:
        if job["operation"] == "Transcribe" and job["input"]["track_mark"] in fresh_ledger["track_marks"]:
            raise ValueError("Planned waveform already has a native history in the retained session")
        if job["operation"] == "Generate" and job["input"]["seed"] in fresh_ledger["seeds"]:
            raise ValueError("Planned seed already has native history in the retained session")
    config = read_json(PROJECT / "runtime.json")
    models = {model["id"]: model for model in read_json(PROJECT / "models.json")["models"]}
    prior = {name: readiness(args.doctor_report, config, models[name]) for name in ["sheetsage2-bf16", "yue2-bf16"]}
    client, identity = RuntimeClient(args.url), Identity(args)
    state = queue(client)
    if state["queue_running"] or state["queue_pending"]:
        raise RuntimeFailure("/queue", "Runtime must initially be idle")
    observed = client.get_json("/system_stats")
    if observed.get("system", {}).get("pytorch_version") != config["torch"] or str(observed.get("system", {}).get("python_version", "")).split(" ")[0] != config["python"]:
        raise ValueError("Live Runtime Python/Torch differs from pinned baseline")
    record = dict(schema_version=1, run_id=uuid.uuid4().hex, evidence_kind=args.evidence_kind, status="unverified", p0_passed=False,
                  items=[], schema=client.get_json("/object_info"), process_identity=identity.initial or identity.read(),
                  provenance=dict(plan_sha256=sha256(args.prepared / "plan.json"), readiness=prior, models=models, config=config,
                                  retained_session=True, settings="Frozen graph values; no tuning/retry/free between ten items",
                                  helper_sha256={path.name: sha256(path) for path in (PROJECT / "p0").glob("*.py")}))
    record["provenance"]["model_files"] = model_files(prior, args.evidence_kind)
    mapping = dict(schema_version=1, run_id=record["run_id"], jobs={})
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if any(args.output_dir.iterdir()):
        raise ValueError("Run output must be empty; prior evidence is preserved")
    write_json(args.output_dir / "plan.json", plan)
    record["retained_files"] = dict(policy="No model/input/output/song/evidence deletion; owned outputs copied and hashed",
                                   before=files_manifest(args.state_root))
    sampler = MemorySampler(client, args.sample_interval, args.output_dir / "resource-samples.jsonl", args.process_pid, args.runtime_main)
    try:
        with sampler:
            record["initial_idle"] = idle(client, identity, sampler, args)
            g5_graph = None
            for job in plan["jobs"][:10]:
                graph = execute(job, client, identity, sampler, args, record, mapping)
                if job["label"] == "G5":
                    g5_graph = graph
            identity.read()
            pre_free = queue(client)
            if pre_free["queue_running"] or pre_free["queue_pending"]:
                raise RuntimeFailure("/free", "Runtime is no longer idle; cleanup flags are not sent.", details=pre_free)
            record["cleanup"] = dict(free_attempted=True, acknowledgement_only=True, witness_verified=False, request={"unload_models": True, "free_memory": True})
            write_json(args.output_dir / "report.json", record)
            reply = client.post_json_bytes("/free", record["cleanup"]["request"])
            record["cleanup"].update(response_bytes=len(reply), post_ack_idle=idle(client, identity, sampler, args), core_fingerprint=fingerprint(g5_graph, plan["jobs"][10]["manifest"]))
            execute(plan["jobs"][10], client, identity, sampler, args, record, mapping, g5_graph=g5_graph)
            execute(plan["jobs"][11], client, identity, sampler, args, record, mapping)
            record["cleanup"]["witness_verified"] = True
            record["trend_review"] = trends(record["items"])
            record["status"] = "completed"
    except (OSError, ValueError, RuntimeFailure, GenerationFailure) as error:
        record.update(status="failed", error=str(error), error_details=getattr(error, "details", None))
        if record["items"] and record["items"][-1]["status"] != "completed":
            record["items"][-1].update(status="failed", error=str(error))
    samples = sampler.snapshot()
    for item in record["items"]:
        if "memory" not in item:
            continue
        for phase, previous in item["memory"].items():
            item["memory"][phase] = window(samples, previous["start_elapsed_seconds"], previous["end_elapsed_seconds"])
        write_json(args.output_dir / item["label"] / "item.json", item)
    if "initial_idle" in record:
        previous = record["initial_idle"]
        record["initial_idle"] = window(samples, previous["start_elapsed_seconds"], previous["end_elapsed_seconds"])
    if "post_ack_idle" in record.get("cleanup", {}):
        previous = record["cleanup"]["post_ack_idle"]
        record["cleanup"]["post_ack_idle"] = window(samples, previous["start_elapsed_seconds"], previous["end_elapsed_seconds"])
    if "trend_review" in record:
        record["trend_review"] = trends(record["items"])
    record["sampling"] = sampler.summary()
    record["sampling"]["sampling_window"] = "One series sampler: first pre-submission idle through ten jobs, artifact validation, every same-duration idle, one /free and two cleanup witnesses; failed run ends at its failure boundary"
    record["sampling"]["whole_window"] = window(samples, 0, time.monotonic() - sampler.began)
    record["finished_at"] = datetime.now(timezone.utc).isoformat()
    record["retained_files"]["after"] = files_manifest(args.state_root)
    final_models = model_files(prior, args.evidence_kind)
    if final_models != record["provenance"]["model_files"]:
        record.update(status="failed", error="Model path/size/mtime changed during series; provenance is unverified")
    record["provenance"]["model_files_after"] = final_models
    write_json(args.output_dir / "report.json", record)
    render(args.output_dir, args.output_dir, args.prior_root)
    return record


def model_files(prior, kind):
    if kind != "real":
        return dict(state="fake/unverified")
    result = {}
    for name, receipt in prior.items():
        facts = receipt["verified_checks"]["model:" + name]["facts"]
        path = Path(facts["path"])
        stat = path.stat()
        if stat.st_size != facts["size_bytes"]:
            raise ValueError("Pinned model file size changed after Doctor validation")
        result[name] = dict(path=str(path.resolve()), bytes=stat.st_size, mtime_ns=stat.st_mtime_ns,
                            validated_sha256=facts["actual_sha256"], hash_scope="Reused successful Doctor full SHA; immutable owner scope plus size/mtime continuity, not rehashed per item")
    return result


def files_manifest(root):
    if root is None:
        return dict(state="unavailable", reason="No Runtime working-directory root supplied")
    return dict(root=str(root.resolve()), files=[dict(path=str(path.relative_to(root)), bytes=path.stat().st_size, mtime_ns=path.stat().st_mtime_ns)
                                               for path in sorted(root.rglob("*")) if path.is_file()],
                scope="Metadata only for declared Runtime work directory; no model files or global deletion")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["prepare", "run", "report"])
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--ledger-root", type=Path)
    parser.add_argument("--prepared", type=Path)
    parser.add_argument("--run-dir", type=Path)
    parser.add_argument("--prior-root", type=Path)
    parser.add_argument("--assessment", type=Path)
    parser.add_argument("--doctor-report", type=Path)
    parser.add_argument("--runtime-log", type=Path)
    parser.add_argument("--process-pid", type=int)
    parser.add_argument("--runtime-main", type=Path)
    parser.add_argument("--state-root", type=Path)
    parser.add_argument("--url", default="http://127.0.0.1:8188")
    parser.add_argument("--evidence-kind", choices=["real", "fake"], default="real")
    parser.add_argument("--timeout", type=float, default=1800)
    parser.add_argument("--poll-interval", type=float, default=0.2)
    parser.add_argument("--sample-interval", type=float, default=1)
    parser.add_argument("--idle-seconds", type=float, default=2)
    args = parser.parse_args()
    if any(not math.isfinite(value) or value <= 0 for value in [args.timeout, args.poll_interval, args.sample_interval, args.idle_seconds]):
        parser.error("All timing bounds must be finite and positive")
    address = urlsplit(args.url)
    if address.scheme != "http" or address.hostname not in {"127.0.0.1", "localhost", "::1"} or address.username or address.password or address.query or address.fragment:
        parser.error("P0 repeat requires a local HTTP Runtime without embedded credentials")
    try:
        if args.command == "prepare":
            prepare(args.output_dir, args.ledger_root)
        elif args.command == "report":
            if args.run_dir is None:
                raise ValueError("report requires --run-dir")
            render(args.run_dir, args.output_dir, args.prior_root, args.assessment)
        else:
            result = run(args)
            return 0 if result["status"] == "completed" else 1
    except (OSError, ValueError, RuntimeFailure, GenerationFailure) as error:
        parser.exit(1, str(error) + "\n")
    print("Prepared/reported fixed evidence; P0 gate is not changed by this tool.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
