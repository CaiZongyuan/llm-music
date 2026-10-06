"""P0 generation is tested through its public CLI and isolated HTTP fixtures."""

import json
from contextlib import contextmanager
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from urllib.parse import urlsplit
import wave


ROOT = Path(__file__).resolve().parents[3]
CLI = ROOT / "runtime" / "comfyui" / "p0" / "generation.py"


class GenerationTests(unittest.TestCase):
    @contextmanager
    def runtime(self, scenario="success"):
        """An isolated HTTP service; its bytes/facts are explicitly fake evidence."""
        observed = {"submissions": [], "score_reads": [], "history_reads": 0}
        audio = io.BytesIO()
        with wave.open(audio, "wb") as writer:
            writer.setnchannels(1)
            writer.setsampwidth(2)
            writer.setframerate(8000)
            writer.writeframes(b"\x00\x10" * 280000)
        audio_bytes = audio.getvalue()
        abc = "X:1\nT:Fake HTTP fixture\nM:4/4\nL:1/4\nQ:1/4=96\nK:C\nC D E F | G A B c |\n"
        config = json.loads((ROOT / "runtime/comfyui/runtime.json").read_text(encoding="utf-8"))
        schema = {
            "YuE2Options": {"input": {"required": {"cot": [["full", "melody", "off"]], "max_seconds": ["FLOAT"], "keep_model_loaded": ["BOOLEAN"]},
                                             "optional": {key: ["ANY"] for key in ["quantization", "offload", "low_vram", "vae", "device", "attention_backend", "download", "cfg_scale", "ode_steps", "abc_temperature", "abc_top_p", "abc_top_k", "temperature", "top_p", "top_k", "repetition_penalty", "transpose", "vocals_only"]}}},
            "YuE2GenerateSong": {"input": {"required": {"style": ["STRING"], "lyrics": ["STRING"], "seed": ["INT"]}, "optional": {"options": ["YUE2_OPTIONS"]}}},
            "SaveAudio": {"input": {"required": {"audio": ["AUDIO"], "filename_prefix": ["STRING"]}}},
            "PreviewAny": {"input": {"required": {"source": ["*"]}}},
        }

        class Handler(BaseHTTPRequestHandler):
            def respond(self, value, status=200):
                self.send_response(status)
                self.end_headers()
                self.wfile.write(json.dumps(value).encode("utf-8"))

            def do_GET(self):
                path = urlsplit(self.path).path
                if path == "/object_info":
                    self.respond(schema)
                elif path == "/system_stats":
                    self.respond({"system": {"comfyui_version": "0.39.0", "python_version": "3.12.13", "pytorch_version": "2.0.0" if scenario == "wrong_runtime" else config["torch"],
                                               "ram_total": 17179869184, "ram_free": 8589934592},
                                  "devices": [{"name": "cuda:0 " + config["gpu_name"], "type": "cuda", "index": 0,
                                               "vram_total": 8589934592, "vram_free": 3221225472,
                                               "torch_vram_total": 2147483648, "torch_vram_free": 1073741824}]})
                elif path == "/queue":
                    self.respond({"queue_running": [], "queue_pending": []})
                elif path.startswith("/history/"):
                    observed["history_reads"] += 1
                    if observed["history_reads"] == 1:
                        self.respond({})
                    elif scenario == "oom":
                        self.respond({"fixed-prompt": {"status": {"status_str": "error", "completed": True,
                                      "messages": [["execution_start", {"timestamp": 1000000}],
                                                   ["execution_error", {"timestamp": 1030000, "exception_type": "torch.cuda.OutOfMemoryError", "exception_message": "CUDA out of memory"}]]}, "outputs": {}}})
                    else:
                        self.respond({"fixed-prompt": {"status": {"status_str": "success", "completed": True,
                                      "messages": [["execution_start", {"timestamp": 1000000}],
                                                   ["execution_cached", {"nodes": ["1", "2"] if scenario == "cached" else ["1"]}],
                                                   ["execution_success", {"timestamp": 1135000}]]},
                                      "outputs": {"3": {"audio": [{"filename": "fixed.wav", "subfolder": "p0", "type": "output"}]},
                                                  "4": {"text": [abc]}}}})
                elif path == "/view":
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(audio_bytes)
                else:
                    self.respond({"error": "unexpected endpoint"}, 404)

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                if self.path == "/prompt":
                    observed["submissions"].append(body)
                    if observed.get("runtime_log"):
                        with observed["runtime_log"].open("a", encoding="utf-8") as log:
                            log.write("[yue2_comfy] stages: score 3.2 s, performance 90.0 s, acoustic 40.0 s, decode 1.8 s | loading and the rest 6.5 s\n")
                    self.respond({"prompt_id": "fixed-prompt", "node_errors": {}})
                elif self.path == "/yue2/score/read":
                    observed["score_reads"].append(body)
                    self.respond({"ok": True, "sheet": {"cut": False, "seconds": 5, "bars": [{}],
                                  "notes": {"melody": [{"pitch": 60, "length": 1}]}}})
                else:
                    self.respond({"error": "unexpected endpoint"}, 404)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                base = Path(directory)
                models = base / "models"
                models.mkdir()
                model_bytes = b"fake external weight fixture"
                (models / "weight.bin").write_bytes(model_bytes)
                registry = base / "models.json"
                registry.write_text(json.dumps({"schema_version": 1, "models": [{"id": "yue2-bf16", "repository": "test/fake", "revision": "a" * 40,
                                    "filename": "weight.bin", "local_path": "weight.bin", "size_bytes": len(model_bytes),
                                    "sha256": hashlib.sha256(model_bytes).hexdigest(), "weights_license": "test-only"}]}), encoding="utf-8")
                yield base, observed, ["--url", f"http://127.0.0.1:{server.server_port}", "--models-root", str(models),
                                      "--registry", str(registry), "--evidence-kind", "fake", "--run-kind", "cold",
                                      "--poll-interval", "0.01", "--sample-interval", "0.01", "--timeout", "2"]
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_prepare_produces_reviewable_fixed_request_without_runtime_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "prepared"
            result = subprocess.run(
                [sys.executable, str(CLI), "prepare", "--output-dir", str(output)],
                capture_output=True, text=True, encoding="utf-8", timeout=10,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            graph = json.loads((output / "request.json").read_text(encoding="utf-8"))
            inputs = json.loads((output / "input.json").read_text(encoding="utf-8"))
            options = next(node["inputs"] for node in graph.values() if node["class_type"] == "YuE2Options")
            self.assertEqual(options["max_seconds"], 35)
            self.assertEqual(options["quantization"], "bf16")
            self.assertEqual(options["offload"], "on")
            self.assertFalse(options["low_vram"])
            self.assertFalse(options["keep_model_loaded"])
            self.assertEqual(options["cot"], "full")
            self.assertEqual(options["attention_backend"], "sdpa")
            self.assertEqual(options["download"], "off")
            self.assertEqual(options["vae"], "standard")
            song = next(node["inputs"] for node in graph.values() if node["class_type"] == "YuE2GenerateSong")
            self.assertEqual(song["style"], inputs["style"])
            self.assertEqual(song["lyrics"], inputs["lyrics"])
            self.assertEqual(song["seed"], 2026100701)
            self.assertEqual({node["class_type"] for node in graph.values()},
                             {"YuE2Options", "YuE2GenerateSong", "SaveAudio", "PreviewAny"})

    def test_api_generation_preserves_decoded_audio_score_provenance_and_measured_rtf(self):
        with self.runtime() as (base, observed, options):
            output = base / "run"
            result = subprocess.run([sys.executable, str(CLI), "run", "--output-dir", str(output), *options],
                                    capture_output=True, text=True, encoding="utf-8", timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
            self.assertEqual(report["status"], "completed")
            self.assertEqual(report["evidence_kind"], "fake")
            self.assertFalse(report["p0_passed"])
            self.assertEqual(report["outputs"]["audio"]["duration_seconds"], 35)
            self.assertEqual(report["outputs"]["audio"]["decoded_frames"], 280000)
            self.assertTrue((output / "audio.wav").is_file())
            self.assertIn("X:1", (output / "score.abc").read_text(encoding="utf-8"))
            self.assertTrue(report["outputs"]["score"]["validation"]["valid"])
            self.assertAlmostEqual(report["measurements"]["rtf"], 3.857142857, places=6)
            self.assertEqual(report["measurements"]["execution_seconds"], 135)
            self.assertEqual(len(observed["submissions"]), 1)
            self.assertEqual(len(observed["score_reads"]), 1)
            self.assertEqual(report["provenance"]["workflow"]["version"], "1.0.0")
            self.assertEqual(report["provenance"]["models"][0]["state"], "ready")
            self.assertTrue((output / "history.json").is_file())

    def test_resource_report_distinguishes_sampled_device_host_and_unavailable_process_values(self):
        with self.runtime() as (base, observed, options):
            output = base / "measured"
            result = subprocess.run([sys.executable, str(CLI), "run", "--output-dir", str(output), *options],
                                    capture_output=True, text=True, encoding="utf-8", timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
            memory = report["measurements"]["memory"]
            self.assertEqual(memory["sampled_peak_device_vram_used_bytes"], 6442450944)
            self.assertEqual(memory["sampled_peak_comfy_vram_unavailable_bytes"], 5368709120)
            self.assertEqual(memory["sampled_peak_runtime_torch_allocator_bytes"], 1073741824)
            self.assertEqual(memory["sampled_peak_host_ram_used_bytes"], 8589934592)
            self.assertIsNone(memory["sampled_peak_runtime_rss_bytes"])
            self.assertIsNone(memory["process_gpu_resident_bytes"])
            self.assertGreaterEqual(memory["sample_count"], 1)
            self.assertEqual(memory["configured_sample_interval_seconds"], 0.01)
            self.assertIn("whole device", memory["device_scope"])
            self.assertIn("WDDM", memory["process_gpu_unavailable_reason"])
            self.assertIsNone(report["measurements"]["stage_seconds"]["model_load"])
            self.assertTrue((output / "memory-samples.jsonl").is_file())

    def test_baseline_oom_keeps_original_failure_and_does_not_retry_or_change_settings(self):
        with self.runtime("oom") as (base, observed, options):
            output = base / "oom"
            result = subprocess.run([sys.executable, str(CLI), "run", "--output-dir", str(output), *options],
                                    capture_output=True, text=True, encoding="utf-8", timeout=10)
            self.assertEqual(result.returncode, 1)
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
            self.assertEqual(report["status"], "failed")
            self.assertEqual(report["error"]["code"], "runtime_out_of_memory")
            self.assertFalse(report["provenance"]["settings"]["low_vram"])
            self.assertFalse(report["p0_passed"])
            self.assertEqual(len(observed["submissions"]), 1)
            self.assertEqual(observed["score_reads"], [])
            history = json.loads((output / "history.json").read_text(encoding="utf-8"))
            self.assertIn("CUDA out of memory", json.dumps(history))
            self.assertTrue((output / "request.json").is_file())
            self.assertTrue((output / "input.json").is_file())

    def test_cached_core_output_is_preserved_but_never_counted_as_generation_performance(self):
        with self.runtime("cached") as (base, observed, options):
            output = base / "cached"
            result = subprocess.run([sys.executable, str(CLI), "run", "--output-dir", str(output), *options],
                                    capture_output=True, text=True, encoding="utf-8", timeout=10)
            self.assertEqual(result.returncode, 1)
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
            self.assertEqual(report["error"]["code"], "cached_generation")
            self.assertTrue(report["measurements"]["core_cached"])
            self.assertIsNone(report["measurements"]["rtf"])
            self.assertEqual(report["measurements"]["cached_nodes"], ["1", "2"])
            self.assertTrue((output / "audio.wav").is_file())
            self.assertTrue((output / "score.abc").is_file())
            self.assertFalse(report["p0_passed"])

    def test_same_run_log_excerpt_exposes_rounded_stages_without_inventing_exclusive_load_time(self):
        with self.runtime() as (base, observed, options):
            log = base / "runtime.log"
            log.write_text("prior unrelated job must not be included\n", encoding="utf-8")
            observed["runtime_log"] = log
            output = base / "stages"
            result = subprocess.run([sys.executable, str(CLI), "run", "--output-dir", str(output), "--runtime-log", str(log), *options],
                                    capture_output=True, text=True, encoding="utf-8", timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
            measurements = report["measurements"]
            self.assertEqual(measurements["stage_seconds"]["planning_score"], 3.2)
            self.assertEqual(measurements["stage_seconds"]["generating_semantic"], 90)
            self.assertEqual(measurements["stage_seconds"]["synthesizing"], 40)
            self.assertEqual(measurements["stage_seconds"]["decoding_audio"], 1.8)
            self.assertEqual(measurements["loading_and_other_seconds"], 6.5)
            self.assertIsNone(measurements["stage_seconds"]["model_load"])
            self.assertIn("rounded", measurements["stage_observability"])
            excerpt = (output / "runtime-log-01.txt").read_text(encoding="utf-8")
            self.assertIn("stages:", excerpt)
            self.assertNotIn("prior unrelated", excerpt)

    def test_runtime_identity_mismatch_is_rejected_before_any_generation_submission(self):
        with self.runtime("wrong_runtime") as (base, observed, options):
            output = base / "wrong-runtime"
            result = subprocess.run([sys.executable, str(CLI), "run", "--output-dir", str(output), *options],
                                    capture_output=True, text=True, encoding="utf-8", timeout=10)
            self.assertEqual(result.returncode, 1)
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
            self.assertEqual(report["error"]["code"], "runtime_unverified")
            self.assertEqual(observed["submissions"], [])
            self.assertFalse(report["p0_passed"])

    def test_low_vram_retry_requires_an_oom_receipt_and_changes_only_that_inference_setting(self):
        with self.runtime("oom") as (baseline_base, baseline_observed, baseline_options):
            baseline = baseline_base / "baseline"
            first = subprocess.run([sys.executable, str(CLI), "run", "--output-dir", str(baseline), *baseline_options],
                                   capture_output=True, text=True, encoding="utf-8", timeout=10)
            self.assertEqual(first.returncode, 1)
            original = (baseline / "report.json").read_bytes()
            old_graph = json.loads((baseline / "request.json").read_text(encoding="utf-8"))
            with self.runtime() as (base, observed, options):
                output = base / "fallback"
                result = subprocess.run([sys.executable, str(CLI), "run", "--output-dir", str(output),
                                         "--low-vram-after-oom", str(baseline / "report.json"), *options],
                                        capture_output=True, text=True, encoding="utf-8", timeout=10)
                self.assertEqual(result.returncode, 0, result.stderr)
                graph = json.loads((output / "request.json").read_text(encoding="utf-8"))
                expected = dict(old_graph["1"]["inputs"], low_vram=True)
                self.assertEqual(graph["1"]["inputs"], expected)
                self.assertEqual(graph["2"]["inputs"], old_graph["2"]["inputs"])
                report = json.loads((output / "report.json").read_text(encoding="utf-8"))
                self.assertEqual(report["oom_comparison"]["changed_inference_fields"], ["low_vram"])
                self.assertFalse(report["p0_passed"])
            self.assertEqual((baseline / "report.json").read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
