"""Public CLI behavior. Temporary runtimes are fake evidence, never GPU proof."""

import json
import socket
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


CLI = Path(__file__).resolve().parents[1] / "manage.py"


class DoctorTests(unittest.TestCase):
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
        self.assertEqual(model["facts"]["state"], "ready")
        self.assertEqual(model["facts"]["path"], str(model_path))
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
