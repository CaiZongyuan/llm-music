"""Public queue/cancel CLI tests use fake HTTP, never live GPU requests."""

from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import base64
import io
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
import wave
from urllib.parse import urlsplit


CLI = Path(__file__).resolve().parents[1] / "p0" / "queue_history.py"


class QueueHistoryTests(unittest.TestCase):
    @contextmanager
    def demo_runtime(self, overlap=False, zero_duration=False):
        state = dict(jobs={}, deleted=False, ticks=0, after_delete=False)
        writes = []
        audio = io.BytesIO()
        with wave.open(audio, "wb") as writer:
            writer.setparams((1, 2, 8000, 0, "NONE", "not compressed"))
            writer.writeframes(b"\x00\x10" * 280000)
        audio_bytes = audio.getvalue()
        midi = b'MThd\x00\x00\x00\x06\x00\x00\x00\x01\x01\xe0MTrk\x00\x00\x00\x0d\x00\x90\x3c\x64\x83\x60\x80\x3c\x00\x00\xff\x2f\x00'
        abc = "X:1\nT:Fake queue output\nM:4/4\nL:1/4\nQ:1/4=96\nK:C\nC D E F |\n"
        root = CLI.parents[3]
        gen = json.loads((root / "workflows/generate/workflow.json").read_text(encoding="utf-8"))
        trans = json.loads((CLI.parents[1] / "workflows/transcribe-sheetsage2/v1/workflow.json").read_text(encoding="utf-8"))
        schema = {}
        for node in [*gen.values(), *trans.values()]:
            schema.setdefault(node["class_type"], {"input": {"required": {}, "optional": {}}})["input"]["optional"].update({name: ["ANY"] for name in node["inputs"]})

        def row(label):
            job = state["jobs"][label]
            return [["A", "B", "C", "D"].index(label), "prompt-" + label, job["prompt"], {"client_id": job["client_id"]}, []]

        class Handler(BaseHTTPRequestHandler):
            def respond(self, result):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())

            def do_GET(self):
                path = urlsplit(self.path).path
                if path == "/queue":
                    if not state["jobs"]:
                        self.respond(dict(queue_running=[], queue_pending=[]))
                    elif not state["deleted"]:
                        self.respond(dict(queue_running=[row("A")], queue_pending=[row(label) for label in ["B", "C", "D"] if label in state["jobs"]]))
                    else:
                        if state["after_delete"]:
                            state["ticks"] += 1
                        state["after_delete"] = True
                        stage = state["ticks"]
                        running = "A" if stage == 0 else "B" if stage == 1 else "D" if stage == 2 else None
                        pending = ["B", "D"] if stage == 0 else ["D"] if stage == 1 else []
                        self.respond(dict(queue_running=[row(running)] if running else [], queue_pending=[row(label) for label in pending]))
                elif path == "/system_stats":
                    self.respond({"system": {"python_version": "3.12.13", "pytorch_version": "2.10.0+cu130"}})
                elif path == "/object_info":
                    self.respond(schema)
                elif path == "/view":
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(audio_bytes)
                elif path.startswith("/history/prompt-"):
                    label = path[-1]
                    done_at = {"A": 1, "B": 2, "D": 3}.get(label, 999)
                    if state["ticks"] < done_at:
                        self.respond({})
                    else:
                        start = {"A": 1000, "B": 1500 if overlap else 2000, "D": 3000}[label]
                        identifier = "prompt-" + label
                        outputs = {"score": {"text": [abc]}} if label == "B" else {"4": {"text": [abc]}, "3": {"audio": [{"filename": label + ".wav", "subfolder": "fake", "type": "output"}]}}
                        self.respond({identifier: {"prompt": row(label), "outputs": outputs, "status": {"status_str": "success", "completed": True,
                                      "messages": [["execution_start", {"prompt_id": identifier, "timestamp": start}],
                                                   ["execution_cached", {"nodes": []}],
                                                   ["execution_success", {"prompt_id": identifier, "timestamp": start if zero_duration else start + 1000}]]}}})
                else:
                    self.send_error(404)

            def do_POST(self):
                raw = self.rfile.read(int(self.headers["Content-Length"]))
                body = json.loads(raw) if self.headers["Content-Type"].startswith("application/json") else None
                writes.append((self.path, body))
                if self.path == "/prompt":
                    label = body["client_id"].split(":")[-1]
                    state["jobs"][label] = body
                    self.respond({"prompt_id": "prompt-" + label, "node_errors": {}})
                elif self.path == "/queue":
                    state["deleted"] = body == {"delete": ["prompt-C"]}
                    self.send_response(200)
                    self.end_headers()
                elif self.path == "/upload/image":
                    self.respond({"name": "score.mid" if b"candidate.mid" in raw else "reference.wav", "subfolder": "fake", "type": "input"})
                elif self.path == "/yue2/score/read":
                    self.respond({"ok": True, "sheet": {"cut": False, "seconds": 5, "bars": [{}], "notes": {"Vocal": [{"pitch": 60, "length": 1}]}}})
                elif self.path == "/yue2/score/midi":
                    self.respond({"ok": True, "data": base64.b64encode(midi).decode()})
                elif self.path == "/yue2/midi/tracks":
                    self.respond({"ok": True, "parts": [{"notes": 1}]})
                else:
                    self.send_error(404)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}", writes
        finally:
            server.shutdown()
            server.server_close()
            worker.join()

    def run_demo(self, root, address):
        project = CLI.parents[1]
        config = json.loads((project / "runtime.json").read_text(encoding="utf-8"))
        models = json.loads((project / "models.json").read_text(encoding="utf-8"))["models"]
        checks = [{"id": name, "status": "passed", "facts": {"revision": config["sources"][name]["revision"]}} for name in ["comfyui", "plugin"]]
        checks += [{"id": "model:" + model["id"], "status": "passed", "facts": {**model, "state": "ready", "actual_sha256": model["sha256"]}} for model in models]
        ready = root / "ready.json"
        ready.write_text(json.dumps({"ready": True, "checks": checks, "verification_scope": "fake HTTP only"}), encoding="utf-8")
        output = root / "evidence"
        result = subprocess.run([sys.executable, str(CLI), "run", "--doctor-report", str(ready), "--url", address,
                                 "--output-dir", str(output), "--evidence-kind", "fake", "--poll-interval", "0.01", "--timeout", "5"],
                                capture_output=True, text=True, encoding="utf-8")
        return result, json.loads((output / "report.json").read_text(encoding="utf-8")), output

    def test_complete_owned_mixed_queue_recovers_outputs_and_proves_pending_cancel(self):
        with tempfile.TemporaryDirectory() as directory, self.demo_runtime() as (address, writes):
            result, report, output = self.run_demo(Path(directory), address)
            self.assertTrue((output / "A/audio.wav").exists())
            self.assertTrue((output / "B/score.mid").exists())
            self.assertTrue((output / "D/audio.wav").exists())
            self.assertFalse((output / "C/history.json").exists())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(report["verified"])
        self.assertEqual(report["concurrency"], 1)
        self.assertTrue(report["cancellation"]["never_started_proven"])
        self.assertEqual([body["client_id"].split(":")[-1] for path, body in writes if path == "/prompt"], ["A", "B", "C", "D"])
        self.assertFalse(any(path == "/interrupt" for path, body in writes))

    def test_overlapping_history_intervals_cannot_claim_serial_execution(self):
        with tempfile.TemporaryDirectory() as directory, self.demo_runtime(overlap=True) as (address, writes):
            result, report, output = self.run_demo(Path(directory), address)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(report["verified"])
        self.assertIn("overlap", report["error"])

    def test_zero_length_history_intervals_cannot_substantiate_real_work(self):
        with tempfile.TemporaryDirectory() as directory, self.demo_runtime(zero_duration=True) as (address, writes):
            result, report, output = self.run_demo(Path(directory), address)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(report["verified"])
        self.assertIn("timestamps", report["error"])
    @contextmanager
    def runtime(self, scenario="removed"):
        writes = []
        state = dict(deleted=False)

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == "/queue":
                    target = [2, "target", {}, {"client_id": "foreign" if scenario == "foreign" else "run:C"}, []]
                    other = [3, "other", {}, {"client_id": "run:D"}, []]
                    if state["deleted"] and scenario == "race":
                        result = dict(queue_running=[target], queue_pending=[other])
                    else:
                        result = dict(queue_running=[[0, "active", {}, {"client_id": "run:A"}, []]],
                                      queue_pending=[other] if state["deleted"] and scenario == "removed" else [target, other])
                else:
                    result = {"target": {"status": {"status_str": "success", "completed": True}, "outputs": {}}} if scenario == "history_race" and state["deleted"] else {}
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                writes.append((self.path, body))
                state["deleted"] = True
                self.send_response(200)
                self.end_headers()

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}", writes
        finally:
            server.shutdown()
            server.server_close()
            worker.join()

    def cancel(self, address):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            mapping = root / "mapping.json"
            mapping.write_text(json.dumps({"schema_version": 1, "run_id": "run", "jobs": {
                "A": {"prompt_id": "active", "client_id": "run:A"},
                "C": {"prompt_id": "target", "client_id": "run:C"},
                "D": {"prompt_id": "other", "client_id": "run:D"}}}), encoding="utf-8")
            output = root / "evidence"
            result = subprocess.run([sys.executable, str(CLI), "cancel-queued", "--run-map", str(mapping),
                                     "--target", "C", "--output-dir", str(output), "--url", address, "--evidence-kind", "fake"],
                                    capture_output=True, text=True, encoding="utf-8")
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
        return result, report

    def test_exact_owned_pending_delete_is_observed_without_claiming_never_started(self):
        with self.runtime() as (address, writes):
            result, report = self.cancel(address)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(writes, [("/queue", {"delete": ["target"]})])
        self.assertEqual(report["cancellation"]["outcome"], "removed_pending")
        self.assertFalse(report["cancellation"]["never_started_proven"])
        self.assertFalse(report["p0_passed"])

    def test_foreign_pending_owner_prevents_every_write(self):
        with self.runtime("foreign") as (address, writes):
            result, report = self.cancel(address)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(writes, [])
        self.assertIn("ownership", report["error"])

    def test_pending_to_running_race_is_a_noop_and_never_interrupts_successor(self):
        with self.runtime("race") as (address, writes):
            result, report = self.cancel(address)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(writes, [("/queue", {"delete": ["target"]})])
        self.assertEqual(report["cancellation"]["outcome"], "moved_to_running_or_history")
        self.assertFalse(report["cancellation"]["never_started_proven"])

    def test_empty_http_success_does_not_prove_the_pending_item_was_deleted(self):
        with self.runtime("unchanged") as (address, writes):
            result, report = self.cancel(address)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(report["cancellation"]["outcome"], "still_pending")
        self.assertFalse(report["cancellation"]["never_started_proven"])

    def test_history_after_delete_prevents_never_started_claim(self):
        with self.runtime("history_race") as (address, writes):
            result, report = self.cancel(address)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(report["cancellation"]["outcome"], "moved_to_running_or_history")
        self.assertFalse(report["cancellation"]["never_started_proven"])
