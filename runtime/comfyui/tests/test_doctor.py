"""Public CLI behavior. Temporary runtimes are fake evidence, never GPU proof."""

import json
from contextlib import contextmanager
import socket
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest


CLI = Path(__file__).resolve().parents[1] / "manage.py"


class DoctorTests(unittest.TestCase):
    @contextmanager
    def external_runtime(self, capacity_bytes, probe_scenario="complete"):
        """Fake external libraries exercise the real CLI and real probe process."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = json.loads((CLI.parent / "runtime.json").read_text(encoding="utf-8"))
            (root / "torch.py").write_text(textwrap.dedent(f"""
                from types import SimpleNamespace
                __version__ = {config['torch']!r}
                version = SimpleNamespace(cuda={config['torch_cuda']!r})
                bfloat16 = 'FAKE BF16; NO CUDA EXECUTION'
                class Tensor:
                    def __matmul__(self, other): return self
                def ones(*args, **kwargs): return Tensor()
                def zeros(*args, **kwargs): return Tensor()
                cuda = SimpleNamespace(
                    is_available=lambda: True, current_device=lambda: 0,
                    get_device_properties=lambda index: SimpleNamespace(
                        name={config['gpu_name']!r}, total_memory={capacity_bytes}),
                    is_bf16_supported=lambda: True, synchronize=lambda: None,
                    empty_cache=lambda: None)
            """), encoding="utf-8")
            (root / "torchaudio.py").write_text(
                "from types import SimpleNamespace\n__version__ = 'FAKE'\n"
                "functional = SimpleNamespace(resample=lambda *args: None)\n", encoding="utf-8")
            (root / "tiktoken.py").write_text("# Fake external tokenizer dependency\n", encoding="utf-8")
            nodes = textwrap.dedent("""
                import importlib.util
                import sys
                NODE_CLASS_MAPPINGS = {}
                async def load_custom_node(path):
                    name = path.replace('.', '_x_')
                    spec = importlib.util.spec_from_file_location(name, path + '/__init__.py')
                    module = importlib.util.module_from_spec(spec)
                    sys.modules[name] = module
                    spec.loader.exec_module(module)
                    NODE_CLASS_MAPPINGS.update(module.NODE_CLASS_MAPPINGS)
                    return True
            """)
            if probe_scenario == "nonzero_after_complete":
                nodes = "import atexit,os\natexit.register(lambda: os._exit(7))\n" + nodes
            elif probe_scenario == "after_complete":
                nodes = "import atexit,sys,time\ndef stall_exit():\n    print('STALLED_EXIT', file=sys.stderr, flush=True)\n    time.sleep(3)\natexit.register(stall_exit)\n" + nodes
                config["probe_timeout_seconds"] = 1
            elif probe_scenario == "stalled_import":
                nodes = "import sys,time\nprint('x' * 10000 + 'STALLED_NODES_IMPORT', file=sys.stderr, flush=True)\ntime.sleep(3)\n" + nodes
                config["probe_timeout_seconds"] = 1
            (root / "nodes.py").write_text(nodes, encoding="utf-8")
            plugin = root / "custom_nodes" / "YuE2-ComfyUI"
            plugin.mkdir(parents=True)
            (plugin / "__init__.py").write_text(
                "NODE_CLASS_MAPPINGS = " + repr(dict.fromkeys(config["required_nodes"])) + "\n", encoding="utf-8")
            for module in ["vendor.yue2.modeling_yue2", "vendor.yue2.modeling_vae",
                           "vendor.yue2.tokenization_yue2", "sheetsage.model"]:
                path = plugin / "yue2_comfy" / (module.replace(".", "/") + ".py")
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("# Fake external modeling dependency\n", encoding="utf-8")
                for parent in path.parents:
                    if parent == plugin:
                        break
                    (parent / "__init__.py").touch()
            for name, path in [("comfyui", root), ("plugin", plugin)]:
                subprocess.run(["git", "init", str(path)], capture_output=True, check=True)
                subprocess.run(["git", "-C", str(path), "add", "."], capture_output=True, check=True)
                subprocess.run(["git", "-C", str(path), "-c", "user.name=External fixture", "-c",
                                "user.email=fixture@example.invalid", "commit", "-m", "fake external runtime"],
                               capture_output=True, check=True)
                config["sources"][name]["revision"] = subprocess.run(
                    ["git", "-C", str(path), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
            config_path = root / "config.json"
            config_path.write_text(json.dumps(config), encoding="utf-8")
            smi = root / "fake-nvidia-smi.cmd"
            smi.write_text("@echo off\r\necho 0, " + config["gpu_name"] + ", 8192, 8192, FAKE\r\n", encoding="ascii")
            (root / "weight.bin").write_bytes(b"hello")
            with socket.socket() as available:
                available.bind(("127.0.0.1", 0))
                port = available.getsockname()[1]
            yield directory, ["--runtime-config", str(config_path), "--nvidia-smi", str(smi), "--port", str(port)]

    def test_nominal_eight_gib_capacity_preserves_raw_bytes_and_rejects_smaller_gpu(self):
        # Actual CUDA reports 8191.5 MiB; NVIDIA reports nominal 8192 MiB.
        for capacity, rounded_mib, expected in [(8589410304, 8192, "passed"), (6442450944, 6144, "failed")]:
            with self.subTest(capacity=capacity), self.external_runtime(capacity) as (directory, extra):
                result = self.run_fixture(directory, *extra, "--json")
                report = json.loads(result.stdout)
                check = next(check for check in report["checks"] if check["id"] == "torch_cuda")
                self.assertEqual(check["status"], expected)
                self.assertEqual(check["facts"]["vram_bytes"], capacity)
                self.assertEqual(check["facts"]["vram_rounded_mib"], rounded_mib)
                self.assertEqual(report["ready"], expected == "passed")
                self.assertFalse(report["p0_passed"])

    def test_probe_timeout_keeps_completed_cuda_facts_and_bounded_stage_diagnostics(self):
        with self.external_runtime(8589934592, probe_scenario="stalled_import") as (directory, extra):
            result = self.run_fixture(directory, *extra, "--json")
        report = json.loads(result.stdout)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(report["ready"])
        cuda = next(check for check in report["checks"] if check["id"] == "torch_cuda")
        self.assertEqual(cuda["status"], "passed")
        self.assertEqual(cuda["facts"]["vram_bytes"], 8589934592)
        probe = next(check for check in report["checks"] if check["id"] == "runtime_probe")
        self.assertEqual(probe["status"], "failed")
        self.assertTrue(probe["facts"]["timed_out"])
        self.assertEqual(probe["facts"]["last_stage"], "comfyui_import")
        self.assertIn("STALLED_NODES_IMPORT", probe["facts"]["stderr_tail"])
        self.assertIn("MUSIC_DOCTOR_JSON=", probe["facts"]["stdout_tail"])
        self.assertLessEqual(len(probe["facts"]["stderr_tail"]), 4096)
        self.assertLessEqual(len(probe["facts"]["stdout_tail"]), 4096)

    def test_probe_timeout_after_all_positive_checkpoints_still_prevents_ready(self):
        with self.external_runtime(8589934592, probe_scenario="after_complete") as (directory, extra):
            result = self.run_fixture(directory, *extra, "--json")
        report = json.loads(result.stdout)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(report["ready"])
        checks = {check["id"]: check for check in report["checks"]}
        for identifier in ["torch_cuda", "runtime_import", "custom_nodes"]:
            self.assertEqual(checks[identifier]["status"], "passed")
        self.assertEqual(checks["runtime_probe"]["status"], "failed")
        self.assertTrue(checks["runtime_probe"]["facts"]["timed_out"])
        self.assertFalse(checks["runtime_probe"]["facts"]["process_completed"])

    def test_nonzero_probe_exit_preserves_positive_facts_without_claiming_ready(self):
        with self.external_runtime(8589934592, probe_scenario="nonzero_after_complete") as (directory, extra):
            result = self.run_fixture(directory, *extra, "--json")
        report = json.loads(result.stdout)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(report["ready"])
        checks = {check["id"]: check for check in report["checks"]}
        for identifier in ["torch_cuda", "runtime_import", "custom_nodes"]:
            self.assertEqual(checks[identifier]["status"], "passed")
        self.assertEqual(checks["runtime_probe"]["status"], "failed")
        self.assertEqual(checks["runtime_probe"]["facts"]["exit_code"], 7)

    def run_fixture(self, directory, *extra):
        model = {
            "id": "fixture", "name": "Fake test weight", "provider": "test",
            "repository": "test/fixture", "revision": "a" * 40,
            "filename": "weight.bin", "local_path": "weight.bin", "size_bytes": 5,
            "sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
            "weights_license": "test-only", "license_source": "test-only", "hash_source": "test-only",
        }
        registry = Path(directory) / "models.json"
        registry.write_text(json.dumps({"schema_version": 1, "models": [model]}), encoding="utf-8")
        return subprocess.run(
            [sys.executable, str(CLI), "doctor", "--runtime-root", directory, "--models-root", directory,
             "--registry", str(registry), "--nvidia-smi", "no-such-nvidia-smi", *extra],
            capture_output=True, text=True, encoding="utf-8",
        )

    def test_full_hash_rejects_a_same_length_corrupt_model(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / "weight.bin").write_bytes(b"HELLO")
            result = self.run_fixture(directory, "--json")
        report = json.loads(result.stdout)
        model = next(check for check in report["checks"] if check["id"] == "model:fixture")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(model["facts"]["state"], "invalid")
        self.assertIn("invalid SHA256", model["message"])
        self.assertNotEqual(model["facts"]["actual_sha256"], model["facts"]["sha256"])

    def test_interrupted_download_is_not_a_ready_model_and_human_output_explains_recovery(self):
        with tempfile.TemporaryDirectory() as directory:
            partial = Path(directory) / "weight.bin.part"
            partial.write_bytes(b"hel")
            result = self.run_fixture(directory)
            self.assertEqual(partial.read_bytes(), b"hel")
        self.assertEqual(result.returncode, 1)
        self.assertIn("Runtime NOT READY", result.stdout)
        self.assertIn("Fake test weight: downloading", result.stdout)
        self.assertIn("Recovery:", result.stdout)

    def test_hash_valid_external_model_requires_a_runtime_visible_link(self):
        with tempfile.TemporaryDirectory() as directory:
            model_path = Path(directory) / "renamed-local.bin"
            model_path.write_bytes(b"hello")
            result = self.run_fixture(directory, "--model-path", f"fixture={model_path}", "--json")
            self.assertFalse((Path(directory) / "weight.bin").exists())
            report = json.loads(result.stdout)
            model = next(check for check in report["checks"] if check["id"] == "model:fixture")
            self.assertTrue(Path(model["facts"]["path"]).samefile(model_path))
        self.assertEqual(model["facts"]["state"], "ready")
        self.assertEqual(model["status"], "failed")
        self.assertIn("Runtime", model["recovery"])
        self.assertFalse(report["ready"])

    def test_occupied_port_is_actionable_even_when_other_prerequisites_fail(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
            server.bind(("127.0.0.1", 0))
            server.listen()
            port = server.getsockname()[1]
            with tempfile.TemporaryDirectory() as directory:
                result = self.run_fixture(directory, "--port", str(port), "--json")
        report = json.loads(result.stdout)
        check = next(check for check in report["checks"] if check["id"] == "port")
        self.assertEqual(check["status"], "failed")
        self.assertIn("unused --port", check["recovery"])
        self.assertEqual(check["facts"]["port"], port)

    def test_wrong_or_dirty_source_revision_cannot_be_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "init", str(root)], capture_output=True, check=True)
            source = root / "source.py"
            source.write_text("original", encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "source.py"], check=True)
            subprocess.run(["git", "-C", str(root), "-c", "user.name=CLI fixture", "-c",
                            "user.email=fixture@example.invalid", "commit", "-m", "fixture"],
                           capture_output=True, check=True)
            revision = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"],
                                      capture_output=True, text=True, check=True).stdout.strip()
            config = json.loads((CLI.parent / "runtime.json").read_text(encoding="utf-8"))
            config["sources"]["comfyui"]["revision"] = "a" * 40
            config_path = root / "config.json"
            config_path.write_text(json.dumps(config), encoding="utf-8")
            mismatch = self.run_fixture(directory, "--runtime-config", str(config_path), "--json")
            first = next(check for check in json.loads(mismatch.stdout)["checks"] if check["id"] == "comfyui")
            self.assertEqual(first["status"], "failed")
            self.assertEqual(first["facts"]["revision"], revision)
            config["sources"]["comfyui"]["revision"] = revision
            config_path.write_text(json.dumps(config), encoding="utf-8")
            source.write_text("locally edited", encoding="utf-8")
            dirty = self.run_fixture(directory, "--runtime-config", str(config_path), "--json")
            check = next(check for check in json.loads(dirty.stdout)["checks"] if check["id"] == "comfyui")
        self.assertEqual(check["status"], "failed")
        self.assertIn("source.py", check["facts"]["tracked_changes"])

    def test_model_preparation_preserves_a_corrupt_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            model = Path(directory) / "weight.bin"
            model.write_bytes(b"HELLO")
            self.run_fixture(directory, "--json")  # Writes the external registry fixture.
            result = subprocess.run(
                [sys.executable, str(CLI), "download-models", "--models-root", directory,
                 "--registry", str(Path(directory) / "models.json")],
                capture_output=True, text=True, encoding="utf-8",
            )
            self.assertEqual(model.read_bytes(), b"HELLO")
        self.assertEqual(result.returncode, 1)
        self.assertIn("preserve or remove", result.stderr)

    def test_missing_gpu_runtime_and_models_are_all_reported_without_false_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run(
                [sys.executable, str(CLI), "doctor", "--runtime-root", directory,
                 "--models-root", directory, "--nvidia-smi", "no-such-nvidia-smi", "--json"],
                capture_output=True, text=True, encoding="utf-8",
            )
        self.assertEqual(result.returncode, 1)
        report = json.loads(result.stdout)
        self.assertFalse(report["ready"])
        self.assertFalse(report["p0_passed"])
        failures = {check["id"] for check in report["checks"] if check["status"] == "failed"}
        self.assertTrue({"gpu", "torch_cuda", "comfyui", "model:yue2-bf16",
                         "model:sheetsage2-bf16"}.issubset(failures))
        self.assertTrue(all(check["recovery"] for check in report["checks"] if check["status"] == "failed"))

    def test_invalid_configuration_is_an_actionable_cli_error(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "runtime.json"
            config.write_text('{"schema_version": 99}', encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(CLI), "doctor", "--runtime-config", str(config), "--json"],
                capture_output=True, text=True, encoding="utf-8",
            )
        self.assertEqual(result.returncode, 2)
        report = json.loads(result.stdout)
        self.assertFalse(report["ready"])
        self.assertIn("configuration", report["error"])
        self.assertTrue(report["recovery"])


if __name__ == "__main__":
    unittest.main()
