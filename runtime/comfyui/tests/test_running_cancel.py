"""Public running-cancel CLI checks use isolated fake HTTP, not GPU evidence."""

from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
import wave
from urllib.parse import urlsplit


CLI = Path(__file__).resolve().parents[1] / "p0" / "running_cancel.py"


class RunningCancelTests(unittest.TestCase):
    @contextmanager
    def demo_runtime(self, runtime_log):
        state, writes = dict(jobs={}, cancelled=False, probes=0, b_done=False), []
        graph = json.loads((CLI.parents[3] / "workflows/generate/workflow.json").read_text(encoding="utf-8"))
        schema = {node["class_type"]: {"input": {"optional": {name: ["ANY"] for name in node["inputs"]}}}
                  for node in graph.values()}
        audio = io.BytesIO()
        with wave.open(audio, "wb") as writer:
            writer.setparams((1, 2, 8000, 0, "NONE", "not compressed"))
            writer.writeframes(b"\x00\x10" * 280000)
        abc = "X:1\nT:Fake successor\nM:4/4\nL:1/4\nK:C\nC D E F |\n"

        def row(label):
            job = state["jobs"][label]
            return [0, "owned-" + label, job["prompt"], {"client_id": job["client_id"]}, []]

        class Handler(BaseHTTPRequestHandler):
            def respond(self, value):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(value).encode())

            def do_GET(self):
                path = urlsplit(self.path).path
                if path == "/queue":
                    label = "B" if "B" in state["jobs"] and not state["b_done"] else "A" if "A" in state["jobs"] and not state["cancelled"] else None
                    if label == "A" and not state.get("marker"):
                        with runtime_log.open("ab") as handle:
                            handle.write(b"Writing the score\n")
                        state["marker"] = True
                    self.respond(dict(queue_running=[row(label)] if label else [], queue_pending=[]))
                elif path == "/system_stats":
                    self.respond({"system": {"python_version": "3.12.13", "pytorch_version": "2.10.0+cu130"}})
                elif path == "/object_info":
                    self.respond(schema)
                elif path == "/api/jobs/owned-A":
                    self.respond({"id": "owned-A", "status": "cancelled"})
                elif path == "/history/owned-A":
                    entry = {"prompt": row("A"), "outputs": {}, "status": {"status_str": "error", "completed": False,
                             "messages": [["execution_interrupted", {"prompt_id": "owned-A", "timestamp": 2000}]]}} if state["cancelled"] else None
                    self.respond({"owned-A": entry} if entry else {})
                elif path == "/history/owned-B":
                    if state["probes"] == 2:
                        state["b_done"] = True
                    entry = {"prompt": row("B"), "outputs": {"4": {"text": [abc]}, "3": {"audio": [{"filename": "B.wav", "type": "output"}]}},
                             "status": {"status_str": "success", "completed": True,
                             "messages": [["execution_start", {"prompt_id": "owned-B", "timestamp": 3000}],
                                          ["execution_success", {"prompt_id": "owned-B", "timestamp": 4000}]]}}
                    self.respond({"owned-B": entry} if state["b_done"] else {})
                elif path == "/view":
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(audio.getvalue())
                else:
                    self.send_error(404)

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                writes.append((self.path, body))
                if self.path == "/prompt":
                    label = body["client_id"].split(":")[-1]
                    if label == "B" and not state["cancelled"]:
                        self.send_error(409)
                        return
                    state["jobs"][label] = body
                    self.respond({"prompt_id": "owned-" + label})
                elif self.path == "/api/jobs/owned-A/cancel":
                    dispatch = not state["cancelled"]
                    if state["cancelled"]:
                        state["probes"] += 1
                    state["cancelled"] = True
                    self.respond({"cancelled": dispatch})
                elif self.path == "/yue2/score/read":
                    self.respond({"sheet": {"cut": False, "seconds": 5, "bars": [{}], "notes": {"Vocal": [{"pitch": 60, "length": 1}]}}})
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

    @contextmanager
    def runtime(self, scenario="cancelled", runtime_log=None):
        state, writes = {"dispatched": False}, []
        prompt = [0, "owned-A", {}, {"client_id": "run:A"}, []]
        terminal = {"prompt": prompt, "outputs": {}, "status": {"status_str": "error", "completed": False,
                    "messages": [["execution_start", {"prompt_id": "owned-A", "timestamp": 1000}],
                                 ["execution_interrupted", {"prompt_id": "owned-A", "timestamp": 2000}]]}}
        if scenario == "ordinary_error":
            terminal["status"]["messages"][-1][0] = "execution_error"
        if scenario == "late_success":
            terminal["status"].update(status_str="success", completed=True)
            terminal["status"]["messages"][-1][0] = "execution_success"

        class Handler(BaseHTTPRequestHandler):
            def respond(self, value):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(value).encode("utf-8"))

            def do_GET(self):
                path = urlsplit(self.path).path
                if path == "/queue":
                    if scenario == "rotated_log" and not state.get("rotated"):
                        replacement = runtime_log.with_suffix(".replacement")
                        replacement.write_bytes(b"Writing the score\n")
                        replacement.replace(runtime_log)
                        state["rotated"] = True
                    owner = "foreign:A" if scenario == "foreign" else "run:A"
                    current = "owned-B" if scenario == "switched" and state["dispatched"] else "owned-A"
                    self.respond({"queue_running": [[0, current, {}, {"client_id": owner}, []]], "queue_pending": []})
                elif path.startswith("/history/"):
                    self.respond({"owned-A": terminal} if (state["dispatched"] or scenario == "terminal") and scenario not in ["no_terminal", "switched"] else {})
                elif path == "/api/jobs/owned-A":
                    normalized = "failed" if scenario == "ordinary_error" else "completed" if scenario == "late_success" else "cancelled"
                    self.respond({"id": "owned-A", "status": normalized})
                else:
                    self.send_error(404)

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                writes.append((self.path, body))
                if self.path == "/api/jobs/owned-A/cancel":
                    state["dispatched"] = True
                    self.respond({"cancelled": scenario != "switched"})
                else:
                    self.send_error(404)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}", writes
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def cancel(self, address, command="cancel-running", runtime_log=None):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            mapping = base / "run-map.json"
            mapping.write_text(json.dumps({"schema_version": 1, "run_id": "run", "jobs": {
                "A": {"prompt_id": "owned-A", "client_id": "run:A", "graph": {}},
                "B": {"prompt_id": "owned-B", "client_id": "run:B", "graph": {}}}}), encoding="utf-8")
            output = base / "evidence"
            arguments = [sys.executable, str(CLI), command, "--run-map", str(mapping),
                                     "--target", "A", "--url", address, "--output-dir", str(output),
                                     "--evidence-kind", "fake", "--timeout", "0.2", "--poll-interval", "0.01"]
            if runtime_log is not None:
                arguments.extend(["--runtime-log", str(runtime_log)])
            result = subprocess.run(arguments,
                                    capture_output=True, text=True, encoding="utf-8", timeout=5)
            self.assertTrue((output / "report.json").is_file(), result.stderr)
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
        return result, report

    def test_completed_false_interruption_history_is_confirmed_without_global_interrupt(self):
        with self.runtime() as (address, writes):
            result, report = self.cancel(address)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(report["status"], "cancelled")
        self.assertTrue(report["cancellation"]["terminal_confirmed"])
        self.assertFalse(report["cancellation"]["history"]["status"]["completed"])
        self.assertEqual(writes, [("/api/jobs/owned-A/cancel", {})])
        self.assertFalse(report["p0_passed"])

    def test_foreign_current_request_is_rejected_without_write(self):
        with self.runtime("foreign") as (address, writes):
            result, report = self.cancel(address)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(report["verified"])
        self.assertEqual(writes, [])

    def test_old_score_marker_does_not_trigger_new_run(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "runtime.log"
            log.write_bytes(b"Writing the score\n")
            with self.runtime() as (address, writes):
                result, report = self.cancel(address, "observe-score", log)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(writes, [])
        self.assertFalse(report["verified"])

    def test_rotated_log_rejects_marker_in_replacement_file(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "runtime.log"
            log.write_bytes(b"previous run\n")
            with self.runtime("rotated_log", log) as (address, writes):
                result, report = self.cancel(address, "observe-score", log)
        self.assertEqual(result.returncode, 1)
        self.assertIn("identity", report["error"]["message"])
        self.assertEqual(writes, [])

    def test_dispatch_without_terminal_history_is_unconfirmed(self):
        with self.runtime("no_terminal") as (address, writes):
            result, report = self.cancel(address)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(report["cancellation"]["terminal_confirmed"])
        self.assertEqual(len(writes), 1)

    def test_ordinary_error_is_not_cancelled(self):
        with self.runtime("ordinary_error") as (address, writes):
            result, report = self.cancel(address)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(report["cancellation"]["outcome"], "failed")
        self.assertFalse(report["verified"])

    def test_late_success_controls_final_result(self):
        with self.runtime("late_success") as (address, writes):
            result, report = self.cancel(address)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(report["status"], "completed")
        self.assertFalse(report["verified"])

    def test_queue_switch_native_false_does_not_signal_successor(self):
        with self.runtime("switched") as (address, writes):
            result, report = self.cancel(address)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(report["cancellation"]["outcome"], "not_dispatched")
        self.assertEqual(report["cancellation"]["after"]["queue_running"][0][1], "owned-B")
        self.assertEqual(writes, [("/api/jobs/owned-A/cancel", {})])

    def test_repeated_owned_terminal_cancel_sends_no_write(self):
        with self.runtime("terminal") as (address, writes):
            result, report = self.cancel(address)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(report["cancellation"]["guard"], "terminal_no_write")
        self.assertEqual(writes, [])

    def test_full_cancel_then_successor_preserves_prior_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            log, preserved = root / "runtime.log", root / "prior.abc"
            log.write_bytes(b"previous Writing the score\n")
            preserved.write_bytes(b"retained prior output")
            config = json.loads((CLI.parents[1] / "runtime.json").read_text(encoding="utf-8"))
            models = json.loads((CLI.parents[1] / "models.json").read_text(encoding="utf-8"))["models"]
            checks = [{"id": name, "status": "passed", "facts": {"revision": config["sources"][name]["revision"]}}
                      for name in ["comfyui", "plugin"]]
            checks += [{"id": "model:" + model["id"], "status": "passed", "facts": {**model, "state": "ready", "actual_sha256": model["sha256"]}} for model in models]
            ready = root / "ready.json"
            ready.write_text(json.dumps({"ready": True, "checks": checks, "verification_scope": "fake only"}), encoding="utf-8")
            output = root / "evidence"
            with self.demo_runtime(log) as (address, writes):
                result = subprocess.run([sys.executable, str(CLI), "run", "--doctor-report", str(ready),
                                         "--runtime-log", str(log), "--preserve-artifact", str(preserved), "--url", address,
                                         "--output-dir", str(output), "--evidence-kind", "fake", "--timeout", "1", "--poll-interval", "0.01"],
                                        capture_output=True, text=True, encoding="utf-8", timeout=5)
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
            self.assertEqual(result.returncode, 0, report)
            self.assertTrue((output / "B/audio.wav").is_file())
            self.assertEqual(preserved.read_bytes(), b"retained prior output")
        self.assertTrue(report["verified"])
        self.assertFalse(report["p0_passed"])
        self.assertTrue(report["cancellation"]["terminal_confirmed"])
        self.assertEqual([item["dispatch"]["cancelled"] for item in report["controlled_native_noops"]], [False, False])
        self.assertEqual([path for path, body in writes], ["/prompt", "/api/jobs/owned-A/cancel", "/prompt",
                                                         "/api/jobs/owned-A/cancel", "/api/jobs/owned-A/cancel", "/yue2/score/read"])


if __name__ == "__main__":
    unittest.main()
