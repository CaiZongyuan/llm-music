"""Public transcription CLI behavior with fake Runtime HTTP; no GPU evidence."""

import json
import base64
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
import wave


CLI = Path(__file__).resolve().parents[1] / "p0" / "transcribe.py"


class TranscriptionTests(unittest.TestCase):
    @contextmanager
    def fake_runtime(self, scenario="success"):
        events = []
        score = 'X:1\nT:P0 fixture\nM:4/4\nL:1/16\nQ:1/4=120\nV: Vocal clef=treble\nV: Ins clef=treble\nK:C\n% verse\nV: Vocal\nC4D4E4G4|\nV: Ins\nZ|\n'
        midi = b'MThd\x00\x00\x00\x06\x00\x00\x00\x01\x01\xe0MTrk\x00\x00\x00\x0d\x00\x90\x3c\x64\x83\x60\x80\x3c\x00\x00\xff\x2f\x00'

        class Handler(BaseHTTPRequestHandler):
            def respond(self, value):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(value).encode())

            def do_GET(self):
                events.append(("GET", self.path, None))
                if self.path == "/system_stats":
                    self.respond({"system": {"python_version": "3.12.13", "pytorch_version": "2.10.0+cu130", "comfyui_version": "0.39.0"}, "devices": []})
                elif self.path == "/object_info":
                    self.respond(dict.fromkeys(["LoadAudio", "YuE2Options", "YuE2Transcribe", "PreviewAny"], {}))
                elif self.path == "/queue":
                    self.respond({"queue_running": [], "queue_pending": []})
                elif self.path != "/history/test-prompt":
                    self.send_error(404)
                elif scenario == "execution_error":
                    self.respond({"test-prompt": {"outputs": {}, "status": {"status_str": "error", "completed": False,
                                  "messages": [["execution_error", {"exception_message": "SheetSage2 model missing; download=off"}]]}}})
                else:
                    cached = [["execution_cached", {"nodes": ["transcribe"]}]] if scenario == "core_cached" else []
                    self.respond({"test-prompt": {"outputs": {"score": {"text": [score]}, "lyrics": {"text": ["[Verse]"]}},
                                  "status": {"status_str": "success", "completed": True,
                                             "messages": [["execution_start", {"timestamp": 1000}], *cached, ["execution_success", {"timestamp": 2000}]]}}})

            def do_POST(self):
                raw = self.rfile.read(int(self.headers["Content-Length"]))
                payload = json.loads(raw) if self.headers["Content-Type"].startswith("application/json") else None
                events.append(("POST", self.path, payload))
                if self.path == "/upload/image":
                    self.respond({"name": "uploaded.mid" if b"candidate.mid" in raw else "reference.wav", "subfolder": "p0/fake-run", "type": "input"})
                elif self.path == "/prompt":
                    self.respond({"prompt_id": "test-prompt", "node_errors": {}})
                elif self.path == "/yue2/score/read":
                    if scenario == "empty_score":
                        self.respond({"ok": True, "sheet": {"cut": False, "seconds": 2, "bars": [{}], "notes": {}}})
                    else:
                        self.respond({"ok": True, "sheet": {"cut": False, "seconds": 2, "bars": [{}],
                                                           "notes": {"Vocal": [{"start": 0, "length": 4, "pitch": 60}]}}})
                elif self.path == "/yue2/score/midi":
                    self.respond({"ok": True, "data": base64.b64encode(midi).decode()})
                elif self.path == "/yue2/midi/tracks":
                    self.respond({"ok": True, "parts": [{"number": 1, "notes": 1, "name": "Vocal"}], "facts": {"seconds": 0.5}})
                else:
                    self.send_error(404)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}", events
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def run_valid(self, root, address, model_verified=True, fixed_fixture=False):
        source = root / "input.wav"
        with wave.open(str(source), "wb") as audio:
            audio.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
            audio.writeframes(b"\x01\x00" * 24000)
        runtime = json.loads((CLI.parent.parent / "runtime.json").read_text(encoding="utf-8"))
        model = next(m for m in json.loads((CLI.parent.parent / "models.json").read_text(encoding="utf-8"))["models"] if m["id"] == "sheetsage2-bf16")
        checks = [{"id": name, "status": "passed", "facts": {"revision": runtime["sources"][name]["revision"]}} for name in ["comfyui", "plugin"]]
        checks.append({"id": "model:sheetsage2-bf16", "status": "passed", "facts": {**model, "state": "ready", "actual_sha256": model["sha256"]}})
        if not model_verified:
            checks[-1]["status"] = "failed"
            checks[-1]["facts"]["state"] = "missing"
        readiness = root / "fake-readiness.json"
        readiness.write_text(json.dumps({"ready": True, "verification_scope": "FAKE TEST ONLY", "checks": checks}), encoding="utf-8")
        output = root / "evidence"
        command = [sys.executable, str(CLI), "--readiness-report", str(readiness),
                   "--output-dir", str(output), "--base-url", address, "--poll-interval", "0.01"]
        if not fixed_fixture:
            command.extend(["--input", str(source)])
        result = subprocess.run(command,
                                capture_output=True, text=True, encoding="utf-8")
        return result, output

    def test_valid_runtime_result_exports_readable_score_and_midi_with_provenance(self):
        with tempfile.TemporaryDirectory() as directory, self.fake_runtime() as (address, events):
            result, output = self.run_valid(Path(directory), address)
            receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))
            self.assertTrue((output / "score.abc").read_text(encoding="utf-8").startswith("X:1"))
            self.assertTrue((output / "score.mid").read_bytes().startswith(b"MThd"))
            self.assertTrue((output / "history.json").exists())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(receipt["verified"])
        self.assertFalse(receipt["p0_passed"])
        self.assertEqual(receipt["validation"]["abc"]["note_count"], 1)
        self.assertEqual(receipt["validation"]["midi"]["note_count"], 1)
        submitted = next(payload for method, path, payload in events if path == "/prompt")
        transcription = next(node for node in submitted["prompt"].values() if node["class_type"] == "YuE2Transcribe")
        self.assertFalse(transcription["inputs"]["lyrics_auto_recognition"])
        options = next(node for node in submitted["prompt"].values() if node["class_type"] == "YuE2Options")
        self.assertEqual(options["inputs"]["download"], "off")
        self.assertEqual(receipt["provenance"]["workflow"]["id"], "transcribe-sheetsage2")

    def test_missing_model_precondition_prevents_any_runtime_write(self):
        with tempfile.TemporaryDirectory() as directory, self.fake_runtime() as (address, events):
            result, output = self.run_valid(Path(directory), address, model_verified=False)
            receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))
        self.assertEqual(result.returncode, 1)
        self.assertFalse(receipt["verified"])
        self.assertIn("SheetSage2", receipt["error"])
        self.assertFalse(any(method == "POST" for method, path, payload in events))

    def test_default_fixed_fixture_records_legal_source_and_known_waveform_hash(self):
        with tempfile.TemporaryDirectory() as directory, self.fake_runtime() as (address, events):
            result, output = self.run_valid(Path(directory), address, fixed_fixture=True)
            receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(receipt["input"]["fixture"]["license"], "CC0-1.0")
        self.assertEqual(receipt["input"]["duration_seconds"], 16)
        self.assertEqual(receipt["input"]["sha256"], "8cfe7f7dda6d17874bbae291ddcc7b59494de57b242c1b302bc4660537f924a9")

    def test_failed_runtime_execution_keeps_request_history_and_no_success_outputs(self):
        with tempfile.TemporaryDirectory() as directory, self.fake_runtime("execution_error") as (address, events):
            result, output = self.run_valid(Path(directory), address)
            receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))
            self.assertTrue((output / "request.json").exists())
            self.assertTrue((output / "history.json").exists())
            self.assertFalse((output / "score.abc").exists())
            self.assertFalse((output / "score.mid").exists())
        self.assertEqual(result.returncode, 1)
        self.assertFalse(receipt["verified"])
        self.assertIn("model missing", receipt["error"])
        self.assertFalse(any(path == "/yue2/score/midi" for method, path, payload in events))

    def test_empty_parsed_score_never_registers_success_artifacts(self):
        with tempfile.TemporaryDirectory() as directory, self.fake_runtime("empty_score") as (address, events):
            result, output = self.run_valid(Path(directory), address)
            receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))
            self.assertFalse((output / "score.abc").exists())
            self.assertFalse((output / "score.mid").exists())
        self.assertEqual(result.returncode, 1)
        self.assertFalse(receipt["verified"])
        self.assertIn("notes", receipt["error"])

    def test_cached_transcription_output_cannot_be_claimed_as_fresh_inference(self):
        with tempfile.TemporaryDirectory() as directory, self.fake_runtime("core_cached") as (address, events):
            result, output = self.run_valid(Path(directory), address)
            receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))
            self.assertFalse((output / "score.abc").exists())
        self.assertEqual(result.returncode, 1)
        self.assertFalse(receipt["verified"])
        self.assertIn("cache", receipt["error"])
        self.assertFalse(any(path == "/yue2/score/read" for method, path, payload in events))

    def test_unavailable_runtime_is_an_actionable_failed_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            result, output = self.run_valid(Path(directory), "http://127.0.0.1:1")
            receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))
        self.assertEqual(result.returncode, 1)
        self.assertFalse(receipt["verified"])
        self.assertIn("Connection failed", receipt["error"])

    def test_invalid_audio_fails_before_runtime_contact_and_keeps_a_failed_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bad = root / "not-audio.wav"
            bad.write_bytes(b"not a WAV")
            output = root / "evidence"
            result = subprocess.run(
                [sys.executable, str(CLI), "--input", str(bad), "--output-dir", str(output),
                 "--readiness-report", str(root / "unused.json"), "--base-url", "http://127.0.0.1:1"],
                capture_output=True, text=True, encoding="utf-8",
            )
            receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))
            self.assertFalse((output / "score.abc").exists())
            self.assertFalse((output / "score.mid").exists())
        self.assertEqual(result.returncode, 1)
        self.assertEqual(receipt["status"], "failed")
        self.assertFalse(receipt["verified"])
        self.assertIn("WAV", receipt["error"])


if __name__ == "__main__":
    unittest.main()
