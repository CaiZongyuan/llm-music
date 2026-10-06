"""Public P0 repeat/cleanup CLI tests; fake receipts cannot pass the P0 gate."""

import json
import base64
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import shutil
import unittest
import threading
import time
import wave
from urllib.parse import urlsplit


CLI = Path(__file__).resolve().parents[1] / "p0" / "repeat_cleanup.py"


class RepeatCleanupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.prepared_owner = tempfile.TemporaryDirectory()
        cls.prepared = Path(cls.prepared_owner.name) / "prepared"
        result = subprocess.run([sys.executable, str(CLI), "prepare", "--output-dir", str(cls.prepared)], capture_output=True, text=True, encoding="utf-8", timeout=90)
        if result.returncode:
            raise RuntimeError(result.stderr)
        cls.plan = json.loads((cls.prepared / "plan.json").read_text(encoding="utf-8"))

    @classmethod
    def tearDownClass(cls):
        cls.prepared_owner.cleanup()

    @contextmanager
    def runtime(self, log, cached_witness=False, stress_samples=False, delayed_window=False):
        observed = dict(submitted=[], uploads=0, free=0, delayed_stats=0)
        native = {}
        t1_accepted, stats_started, release_stats = threading.Event(), threading.Event(), threading.Event()
        waveform = io.BytesIO()
        with wave.open(waveform, "wb") as audio:
            audio.setparams((1, 2, 8000, 0, "NONE", "not compressed"))
            audio.writeframes(b"\x00\x10" * 280000)
        audio_bytes = waveform.getvalue()
        midi = b'MThd\x00\x00\x00\x06\x00\x00\x00\x01\x01\xe0MTrk\x00\x00\x00\x0d\x00\x90\x3c\x64\x83\x60\x80\x3c\x00\x00\xff\x2f\x00'
        jobs = {job["label"]: job for job in self.plan["jobs"]}
        schema = {}
        for job in self.plan["jobs"]:
            for node in job["graph"].values():
                schema.setdefault(node["class_type"], {"input": {"optional": {}}})["input"]["optional"].update({field: ["ANY"] for field in node["inputs"]})
        abc = "X:1\nM:4/4\nL:1/4\nK:C\nC D E F |\n"

        class Handler(BaseHTTPRequestHandler):
            def reply(self, value):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(value).encode())

            def do_GET(self):
                path = urlsplit(self.path).path
                if path == "/queue":
                    self.reply(dict(queue_running=[], queue_pending=[]))
                elif path == "/system_stats":
                    observed["samples"] = observed.get("samples", 0) + 1
                    delayed_sample = delayed_window and t1_accepted.is_set() and not stats_started.is_set()
                    if delayed_sample:
                        observed["delayed_stats"] += 1
                        stats_started.set()
                        release_stats.wait(2)
                        time.sleep(0.08)
                    if stress_samples and observed["samples"] % 2:
                        time.sleep(0.02)
                    self.reply({"system": {"python_version": "3.12.13", "pytorch_version": "2.10.0+cu130", "ram_total": 10000000, "ram_free": 4000000 if delayed_sample else 5000000},
                                "devices": [{"type": "cuda", "index": 0, "vram_total": 8589410304, "vram_free": 8000000000, "torch_vram_total": 1000000, "torch_vram_free": 500000}]})
                elif path == "/object_info":
                    self.reply(schema)
                elif path.startswith("/history/"):
                    identifier = path.removeprefix("/history/")
                    if delayed_window and identifier == "prompt-T1":
                        stats_started.wait(2)
                    self.reply({identifier: native[identifier]} if identifier in native else {})
                elif path == "/view":
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(audio_bytes)
                else:
                    self.send_error(404)

            def do_POST(self):
                raw = self.rfile.read(int(self.headers["Content-Length"]))
                body = json.loads(raw) if self.headers["Content-Type"].startswith("application/json") else None
                if self.path == "/upload/image":
                    observed["uploads"] += 1
                    import re
                    name = re.search(rb'filename="([^"]+)"', raw).group(1).decode()
                    self.reply({"name": name, "subfolder": "fake", "type": "input"})
                elif self.path == "/prompt":
                    label = body["client_id"].split(":")[-1]
                    job, identifier = jobs[label], "prompt-" + label
                    observed["submitted"].append((label, body))
                    output = {"score": {"text": [abc]}, "transcribe": {"yue2_track": [job["input"]["track_mark"]]}} if job["operation"] == "Transcribe" else {"4": {"text": [abc]}, "3": {"audio": [{"filename": "audio.wav", "type": "output"}]}}
                    cached = ["2"] if cached_witness and label == "G5-after-free" else []
                    native[identifier] = {"prompt": [0, identifier, body["prompt"], {"client_id": body["client_id"]}, []], "outputs": output,
                                          "status": {"status_str": "success", "completed": True, "messages": [["execution_start", {"prompt_id": identifier, "timestamp": 1000}],
                                                                                                                   ["execution_cached", {"nodes": cached}], ["execution_success", {"prompt_id": identifier, "timestamp": 2000}]]}}
                    with log.open("a", encoding="utf-8") as stream:
                        if job["operation"] == "Transcribe":
                            stream.write("loaded sheetsage2_bf16.safetensors on cuda:0\nListening to the recording\nWriting down what it hears\n")
                        else:
                            stream.write("[yue2_comfy.loader] LM: rebuilt\nresident on cuda:0\n[yue2_comfy] stages: score 0.2 s, performance 0.3 s, acoustic 0.2 s, decode 0.1 s | loading and the rest 0.2 s\n[yue2_comfy.loader] unloaded\n")
                    if label == "T1":
                        t1_accepted.set()
                    self.reply({"prompt_id": identifier})
                elif self.path == "/free":
                    observed["free"] += 1
                    self.send_response(200)
                    self.end_headers()
                elif self.path == "/yue2/score/read":
                    self.reply({"sheet": {"cut": False, "seconds": 4, "bars": [{}], "notes": {"Vocal": [{"pitch": 60, "length": 1}]}}})
                elif self.path == "/yue2/score/midi":
                    self.reply({"data": base64.b64encode(midi).decode()})
                elif self.path == "/yue2/midi/tracks":
                    release_stats.set()
                    self.reply({"parts": [{"notes": 1}]})
                else:
                    self.send_error(404)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}", observed
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def execute(self, root, cached_witness=False, changed_process=False, stress_samples=False, process_failure=None, prepared=None, delayed_window=False):
        project = CLI.parents[1]
        config = json.loads((project / "runtime.json").read_text(encoding="utf-8"))
        models = json.loads((project / "models.json").read_text(encoding="utf-8"))["models"]
        checks = [{"id": name, "status": "passed", "facts": {"revision": config["sources"][name]["revision"]}} for name in ["comfyui", "plugin"]]
        checks += [{"id": "model:" + model["id"], "status": "passed", "facts": {**model, "state": "ready", "actual_sha256": model["sha256"]}} for model in models]
        ready, log, output = root / "ready.json", root / "runtime.log", root / "run"
        ready.write_text(json.dumps({"ready": True, "checks": checks}), encoding="utf-8")
        log.write_bytes(b"old logs\n")
        extra, environment = [], dict(os.environ)
        if changed_process or process_failure:
            for check in checks:
                if check["id"].startswith("model:"):
                    model_path = root / (check["facts"]["id"] + ".fake")
                    model_path.write_bytes(b"x")
                    check["facts"].update(path=str(model_path), size_bytes=1)
            ready.write_text(json.dumps({"ready": True, "checks": checks}), encoding="utf-8")
            dependency = root / "external-process"
            dependency.mkdir()
            main = root / "runtime-main.py"
            main.write_text("# fake external main\n", encoding="utf-8")
            (dependency / "psutil.py").write_text(
                "from types import SimpleNamespace\nfrom pathlib import Path\ncounter = 0\n"
                "class Error(Exception): pass\nclass NoSuchProcess(Error): pass\nclass AccessDenied(Error): pass\nclass Process:\n"
                "    def __init__(self,pid): self.pid=pid\n"
                "    def is_running(self): return True\n"
                f"    def cmdline(self): return ['python', {str(main)!r}]\n"
                "    def create_time(self):\n        global counter\n"
                f"        if {bool(process_failure)!r} and 'Writing down what it hears' in Path({str(log)!r}).read_text():\n"
                f"            raise {process_failure or 'Error'}('process query failed after accepted work')\n"
                f"        counter += 1\n        return 10 + counter if {changed_process!r} else 10\n"
                "    def memory_info(self): return SimpleNamespace(rss=1000)\n", encoding="utf-8")
            environment["PYTHONPATH"] = str(dependency)
            ledger = root / "ledger"
            ledger.mkdir()
            extra = ["--evidence-kind", "real", "--process-pid", "100", "--runtime-main", str(main), "--ledger-root", str(ledger)]
        with self.runtime(log, cached_witness, stress_samples, delayed_window) as (address, observed):
            result = subprocess.run([sys.executable, str(CLI), "run", "--prepared", str(prepared or self.prepared), "--output-dir", str(output),
                                     "--doctor-report", str(ready), "--runtime-log", str(log), "--url", address, "--evidence-kind", "fake",
                                     "--poll-interval", "0.01", "--sample-interval", "0.01", "--idle-seconds", "0.01", "--timeout", "1", *extra],
                                    capture_output=True, text=True, encoding="utf-8", timeout=30, env=environment)
        report = json.loads((output / "report.json").read_text(encoding="utf-8")) if (output / "report.json").exists() else None
        return result, report, observed, output

    def test_mixed_series_preserves_exact_g5_replay_and_one_free_without_p0_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            result, report, observed, output = self.execute(Path(directory))
            summary = json.loads((output / "runtime-report.json").read_text(encoding="utf-8"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(report["items"]), 12)
        self.assertEqual(observed["free"], 1)
        self.assertTrue(report["cleanup"]["witness_verified"])
        original = next(body["prompt"] for label, body in observed["submitted"] if label == "G5")
        replay = next(body["prompt"] for label, body in observed["submitted"] if label == "G5-after-free")
        original["3"]["inputs"].pop("filename_prefix")
        replay["3"]["inputs"].pop("filename_prefix")
        self.assertEqual(original, replay)
        self.assertFalse(summary["p0_passed"])
        self.assertIn("every same-duration idle", report["sampling"]["sampling_window"])

    def test_cached_exact_cleanup_replay_stops_without_retry_or_second_free(self):
        with tempfile.TemporaryDirectory() as directory:
            result, report, observed, output = self.execute(Path(directory), cached_witness=True)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(report["cleanup"]["witness_verified"])
        self.assertEqual(observed["free"], 1)
        self.assertEqual(len(observed["submitted"]), 11)
        self.assertIn("cache", report["error"])

    def test_changed_create_time_with_same_pid_stops_before_submission(self):
        with tempfile.TemporaryDirectory() as directory:
            result, report, observed, output = self.execute(Path(directory), changed_process=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(observed["submitted"], [])
        self.assertEqual(observed["free"], 0)
        self.assertIn("PID/create_time", report["error"])

    def test_unavailable_process_after_accepted_work_preserves_failure_evidence(self):
        for failure in ["NoSuchProcess", "AccessDenied"]:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                result, report, observed, output = self.execute(Path(directory), process_failure=failure)
                self.assertEqual(result.returncode, 1)
                self.assertIsNotNone(report, result.stderr)
                self.assertEqual(report["status"], "failed")
                self.assertIn(failure, report["error"])
                self.assertIn("inspect ownership", report["error"])
                self.assertEqual([label for label, _ in observed["submitted"]], ["T1"])
                self.assertEqual(observed["free"], 0)
                mapping = json.loads((output / "run-map.json").read_text(encoding="utf-8"))
                self.assertEqual(list(mapping["jobs"]), ["T1"])
                self.assertEqual(mapping["jobs"]["T1"]["prompt_id"], "prompt-T1")
                self.assertTrue((output / "resource-samples.jsonl").read_text(encoding="utf-8").strip())
                self.assertGreater(report["sampling"]["sample_count"], 0)
                summary = json.loads((output / "runtime-report.json").read_text(encoding="utf-8"))
                self.assertFalse(summary["p0_passed"])

    def test_tampered_transcription_measurement_facts_stop_before_runtime_writes(self):
        original = self.plan["jobs"][0]["input"]
        changes = dict(duration_seconds=original["duration_seconds"] * 2, frames=original["frames"] * 2,
                       sample_rate=original["sample_rate"] * 2, channels=original["channels"] + 1,
                       track_mark="0" * 16, decoded_float32_sha256="0" * 64,
                       sha256="0" * 64, bytes=original["bytes"] + 1)
        for field, value in changes.items():
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                copied = root / "prepared"
                shutil.copytree(self.prepared, copied)
                plan = json.loads((copied / "plan.json").read_text(encoding="utf-8"))
                plan["jobs"][0]["input"][field] = value
                (copied / "plan.json").write_text(json.dumps(plan), encoding="utf-8")
                result, report, observed, output = self.execute(root, prepared=copied)
                self.assertEqual(result.returncode, 1)
                self.assertIn("metadata differs from decoded PCM16 audio", result.stderr)
                self.assertEqual(observed["uploads"], 0)
                self.assertEqual(observed["submitted"], [])
                self.assertEqual(observed["free"], 0)

    def test_closed_windows_include_sample_queries_completed_after_terminal_history(self):
        with tempfile.TemporaryDirectory() as directory:
            result, report, observed, output = self.execute(Path(directory), delayed_window=True)
            samples = [json.loads(line) for line in (output / "resource-samples.jsonl").read_text(encoding="utf-8").splitlines()]
            persisted = {item["label"]: json.loads((output / item["label"] / "item.json").read_text(encoding="utf-8"))["memory"] for item in report["items"]}
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(observed["delayed_stats"], 1)
        active = report["items"][0]["memory"]["active"]
        rows = [row for row in samples if active["start_elapsed_seconds"] <= row["elapsed_seconds"] <= active["end_elapsed_seconds"]]
        self.assertTrue(any(row["host_ram_used_bytes"] == 6000000 for row in rows), "Delayed query must start inside T1 active window")
        for item in report["items"]:
            self.assertEqual(persisted[item["label"]], item["memory"])
            for state in ["active", "idle"]:
                stored = item["memory"][state]
                rows = [row for row in samples if stored["start_elapsed_seconds"] <= row["elapsed_seconds"] <= stored["end_elapsed_seconds"]]
                self.assertEqual(stored["sample_count"], len(rows), (item["label"], state))
                values = [row["host_ram_used_bytes"] for row in rows if row["host_ram_used_bytes"] is not None]
                self.assertEqual(stored["memory"]["host_ram_used_bytes"]["sampled_peak"], max(values) if values else None, (item["label"], state))
        for stored in [report["initial_idle"], report["cleanup"]["post_ack_idle"]]:
            rows = [row for row in samples if stored["start_elapsed_seconds"] <= row["elapsed_seconds"] <= stored["end_elapsed_seconds"]]
            self.assertEqual(stored["sample_count"], len(rows))

    def test_changed_core_ancestor_plan_is_rejected_before_any_runtime_write(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            copied = root / "prepared"
            shutil.copytree(self.prepared, copied)
            plan = json.loads((copied / "plan.json").read_text(encoding="utf-8"))
            plan["jobs"][10]["graph"]["1"]["inputs"]["keep_model_loaded"] = True
            (copied / "plan.json").write_text(json.dumps(plan), encoding="utf-8")
            result = subprocess.run([sys.executable, str(CLI), "run", "--prepared", str(copied), "--output-dir", str(root / "run"),
                                     "--doctor-report", str(root / "unused.json"), "--runtime-log", str(root / "unused.log")],
                                    capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(result.returncode, 1)
        self.assertIn("graph IDs/bindings/settings", result.stderr)

    def test_concurrent_boundary_and_background_samples_have_ordered_atomic_jsonl(self):
        with tempfile.TemporaryDirectory() as directory:
            result, report, observed, output = self.execute(Path(directory), stress_samples=True)
            samples = [json.loads(line) for line in (output / "resource-samples.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(samples), report["sampling"]["sample_count"])
        times = [sample["elapsed_seconds"] for sample in samples]
        self.assertEqual(times, sorted(times))

    def offline_report(self, record, assessment=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run_dir, output = root / "run", root / "summary"
            run_dir.mkdir()
            (run_dir / "report.json").write_text(json.dumps(record), encoding="utf-8")
            command = [sys.executable, str(CLI), "report", "--run-dir", str(run_dir), "--output-dir", str(output)]
            if assessment is not None:
                path = root / "assessment.json"
                path.write_text(json.dumps(assessment), encoding="utf-8")
                command.extend(["--assessment", str(path)])
            result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
            summary = json.loads((output / "runtime-report.json").read_text(encoding="utf-8")) if (output / "runtime-report.json").exists() else None
        return result, summary

    def record(self, kind="fake", cleanup=False):
        return dict(run_id="fixture-run", evidence_kind=kind, status="completed", p0_passed=True,
                    cleanup=dict(acknowledgement_only=True, witness_verified=cleanup),
                    items=[dict(label=label, operation="Transcribe" if label.startswith("T") else "Generate", role="repeat", status="completed",
                                memory=dict(active=dict(sample_count=0), idle=dict(sample_count=0)))
                           for label in ["T1", "G1", "T2", "G2", "T3", "G3", "T4", "G4", "T5", "G5"]])

    def test_fake_success_flags_cannot_promote_cases_or_the_p0_gate(self):
        result, summary = self.offline_report(self.record(cleanup=True))
        self.assertEqual(result.returncode, 0)
        self.assertFalse(summary["p0_passed"])
        self.assertTrue(all(case["status"] == "unverified" for case in summary["cases"].values()))

    def test_free_acknowledgement_without_exact_uncached_witness_is_unverified(self):
        result, summary = self.offline_report(self.record(kind="real", cleanup=False))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(summary["cases"]["cleanup"]["status"], "unverified")
        self.assertFalse(summary["p0_passed"])

    def test_zero_in_window_samples_cannot_inherit_a_series_peak_or_pass_stability(self):
        record = self.record(kind="real")
        record["sampling"] = {"sample_count": 100, "sampled_peak_device_vram_used_bytes": 9000000000}
        assessment = dict(run_id="fixture-run", status="passed", rationale="claimed stable", evidence=["resource-samples.jsonl"], unexplained_growth=False)
        result, summary = self.offline_report(record, assessment)
        self.assertEqual(result.returncode, 1)
        self.assertIsNone(summary)

    def test_prepare_freezes_ten_workloads_and_two_distinct_cleanup_witnesses(self):
        plan = self.plan
        self.assertEqual([job["label"] for job in plan["jobs"]], ["T1", "G1", "T2", "G2", "T3", "G3", "T4", "G4", "T5", "G5", "G5-after-free", "T6-after-free"])
        self.assertEqual(len(set(job["input"]["track_mark"] for job in plan["jobs"] if job["operation"] == "Transcribe")), 6)
        self.assertEqual([job["input"]["seed"] for job in plan["jobs"] if job["operation"] == "Generate"], [2026190101, 2026190102, 2026190103, 2026190104, 2026190105, 2026190105])
        self.assertFalse(plan["p0_passed"])
