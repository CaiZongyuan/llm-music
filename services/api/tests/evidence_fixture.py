"""Owned local process/git/tiny-model facts; synthetic CPU source evidence only."""

from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from dataclasses import asdict

import psutil

from music_api.runtime_evidence import ModelFingerprint, ModelReceipt, ProcessReceipt, RuntimeReceipt
from music_api.runtime_types import ModelRequirement, RuntimeRequirements


PEER_SOURCE = '''from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json, os, sys, threading
from pathlib import Path
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        payloads = {"/system_stats": {"system": {"comfyui_version": "0.39.0", "python_version": "3.12.13", "pytorch_version": "2.10.0+cu130", "ram_total": 32000000000, "ram_free": 20000000000}, "devices": [{"name": "NVIDIA GeForce RTX 3070 Ti Laptop GPU", "type": "cuda", "index": 0, "vram_total": 8589934592, "vram_free": 6442450944, "torch_vram_total": 1073741824, "torch_vram_free": 268435456}]}, "/object_info": {name: {} for name in ["LoadAudio", "YuE2Options", "YuE2Transcribe", "PreviewAny", "YuE2GenerateSong"]}, "/models/checkpoints": [], "/models/audio_encoders": [], "/queue": {"queue_running": [], "queue_pending": []}}
        override = Path(sys.argv[1]).with_suffix(".payloads.json")
        if override.exists(): payloads.update(json.loads(override.read_text(encoding="utf-8")))
        payload = payloads.get(self.path)
        if payload is None:
            self.send_error(404); return
        data = json.dumps(payload).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_POST(self):
        Path(sys.argv[1]).with_suffix(".writes").write_text(self.path, encoding="utf-8")
        self.send_error(503, "CPU evidence peer never performs inference")
    def log_message(self, *args): pass
server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
Path(sys.argv[1]).write_text(json.dumps({"port": server.server_port, "pid": os.getpid()}), encoding="utf-8")
def stop():
    sys.stdin.buffer.read(1)
    server.shutdown()
threading.Thread(target=stop, daemon=True).start()
server.serve_forever()
server.server_close()
'''


def commit_source(path: Path) -> str:
    for arguments in [["init", "-q"], ["add", "."], ["-c", "user.name=CPU fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "Synthetic source"]]:
        subprocess.run(["git", "-C", str(path), *arguments], check=True, capture_output=True)
    return subprocess.check_output(["git", "-C", str(path), "rev-parse", "HEAD"], text=True).strip()


def write_registry_fixture(root: Path, requirements: RuntimeRequirements) -> None:
    """The shared registry loads owned metadata; actual P0 definitions are copied unchanged."""
    import shutil
    runtime = root / "runtime" / "comfyui"
    runtime.mkdir(parents=True, exist_ok=True)
    (runtime / "runtime.json").write_text(json.dumps({
        "python": requirements.python_version, "torch": requirements.torch_version, "gpu_name": requirements.gpu_name,
        "min_vram_mib": 8192, "sources": {
            "comfyui": {"revision": requirements.runtime_revision, "code_license": "fixture only", "license_source": "fixture"},
            "plugin": {"revision": requirements.plugin_revision, "code_license": "fixture only", "license_source": "fixture"},
        },
    }), encoding="utf-8")
    (runtime / "models.json").write_text(json.dumps({"models": [asdict(model) for model in requirements.models]}), encoding="utf-8")
    repository = Path(__file__).resolve().parents[3]
    for relative in ["runtime/comfyui/workflows/transcribe-sheetsage2/v1", "workflows/generate"]:
        target = root / relative
        target.mkdir(parents=True, exist_ok=True)
        for name in ["manifest.json", "workflow.json"]:
            shutil.copyfile(repository / relative / name, target / name)


@contextmanager
def bound_evidence(tmp_path: Path):
    runtime_root = tmp_path / "runtime"
    runtime_root.mkdir()
    entrypoint = runtime_root / "main.py"
    entrypoint.write_text(PEER_SOURCE, encoding="utf-8")
    runtime_revision = commit_source(runtime_root)
    plugin_root = runtime_root / "custom_nodes" / "YuE2-ComfyUI"
    plugin_root.mkdir(parents=True)
    (plugin_root / "fixture.txt").write_text("Synthetic CPU source; no model or inference code", encoding="utf-8")
    plugin_revision = commit_source(plugin_root)
    models_root = tmp_path / "models"
    model = models_root / "audio_encoders" / "sheetsage2_bf16.safetensors"
    model.parent.mkdir(parents=True)
    model.write_bytes(b"abc")
    requirement = ModelRequirement(id="sheetsage2-bf16", name="CPU fixture, not actual weights", provider="isolated fixture",
                                   repository="fixture/weights", revision="a" * 40, filename="audio_encoders/sheetsage2_bf16.safetensors",
                                   local_path="audio_encoders/sheetsage2_bf16.safetensors",
                                   sha256="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", size_bytes=3,
                                   weights_license="CC0 fixture bytes", license_source="isolated fixture", hash_source="known SHA256 of abc")
    requirements = RuntimeRequirements(runtime_revision, plugin_revision, "3.12.13", "2.10.0+cu130",
                                       "NVIDIA GeForce RTX 3070 Ti Laptop GPU", (requirement,), source="isolated CPU fixture registry")
    ready = tmp_path / "peer-ready.json"
    process = subprocess.Popen([sys.executable, str(entrypoint), str(ready)], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                               stderr=subprocess.PIPE, env={**os.environ, "YUE2_MODELS_ROOT": str(models_root)},
                               creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    try:
        deadline = time.monotonic() + 10
        while not ready.exists():
            assert process.poll() is None
            assert time.monotonic() < deadline
            time.sleep(0.02)
        actual = json.loads(ready.read_text(encoding="utf-8"))
        url = "http://127.0.0.1:" + str(actual["port"])
        source_time = datetime.now(timezone.utc)
        fingerprint = model.stat()
        child = psutil.Process(actual["pid"])
        receipt = RuntimeReceipt(schema_version=1, mode="comfyui", runtime_url=url, source="isolated CPU process/model fixture",
                                 checked_at=source_time, runtime_root=runtime_root, models_root=models_root,
                                 runtime_revision=runtime_revision, plugin_revision=plugin_revision,
                                 process=ProcessReceipt(pid=child.pid, create_time=child.create_time(), executable=Path(child.exe()), entrypoint=entrypoint),
                                 models=[ModelReceipt(id=requirement.id, state="ready", revision=requirement.revision, checked_at=source_time,
                                                      actual_sha256=requirement.sha256, actual_size_bytes=3,
                                                      fingerprint=ModelFingerprint(resolved_path=model.resolve(), size_bytes=3, mtime_ns=fingerprint.st_mtime_ns))])
        receipt_path = tmp_path / "owner-receipt.json"
        receipt_path.write_text(receipt.model_dump_json(), encoding="utf-8")
        yield url, requirements, receipt, receipt_path, model, ready.with_suffix(".writes")
    finally:
        if process.poll() is None:
            assert process.stdin is not None
            process.stdin.write(b"\n")
            process.stdin.flush()
            process.stdin.close()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.terminate()
                process.wait(timeout=10)
                raise AssertionError("Owned CPU evidence peer failed graceful stop")
        assert process.returncode == 0
