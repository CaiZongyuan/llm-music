"""Owned CPU HTTP peer returns native read-only payloads; never GPU evidence."""

from collections.abc import Iterator
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import threading
from typing import Any


@contextmanager
def diagnostics_peer(*, unavailable: bool = False) -> Iterator[tuple[str, dict[str, Any]]]:
    payloads: dict[str, Any] = {
        "/system_stats": {
            "system": {"comfyui_version": "0.39.0", "python_version": "3.12.13", "pytorch_version": "2.10.0+cu130",
                       "ram_total": 32000000000, "ram_free": 20000000000, "argv": ["cpu-diagnostics-fixture.py"]},
            "devices": [{"name": "Synthetic CUDA device; CPU fixture only", "type": "cuda", "index": 0,
                         "vram_total": 8589934592, "vram_free": 6442450944,
                         "torch_vram_total": 1073741824, "torch_vram_free": 268435456}],
        },
        "/object_info": {name: {} for name in ["LoadAudio", "YuE2Options", "YuE2Transcribe", "PreviewAny", "YuE2GenerateSong"]},
        "/models/checkpoints": ["yue2_3b_bf16.safetensors"],
        "/models/audio_encoders": ["sheetsage2_bf16.safetensors"],
        "/queue": {"queue_running": [], "queue_pending": []},
    }
    state = {"unavailable": unavailable, "payloads": payloads, "writes": [], "reads": []}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            state["reads"].append(self.path)
            if state["unavailable"]:
                self.send_error(503, "Owned CPU peer unavailable")
                return
            if self.path not in payloads:
                self.send_error(404)
                return
            data = json.dumps(payloads[self.path]).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_POST(self) -> None:
            state["writes"].append(self.path)
            self.send_error(503, "Diagnostics fixture never accepts inference")

        def log_message(self, format: str, *args: object) -> None:
            pass

    peer = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=peer.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{peer.server_port}", state
    finally:
        peer.shutdown()
        peer.server_close()
        thread.join(timeout=5)
        assert not thread.is_alive()
