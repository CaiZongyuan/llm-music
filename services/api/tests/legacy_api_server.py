"""Launch immutable pre-0004 source against an owned CPU native peer."""

import json
from pathlib import Path
import socket
import sys


sys.path.insert(0, sys.argv[1])

import uvicorn
from music_api.comfy_runtime import ComfyUIRuntime
from music_api.config import Settings
from music_api.main import create_app
from music_api.workflow_registry import WorkflowRegistry


class UnexpectedAcceptanceFailure(ComfyUIRuntime):
    def submit(self, request):
        super().submit(request)
        raise RuntimeError("Owned legacy post-accept failure")


data, peer, receipt, registry_root, ready, mode = sys.argv[2:]
settings = Settings(data_dir=Path(data), runtime_mode="comfyui", runtime_url=peer, runtime_evidence_path=Path(receipt))
registry = WorkflowRegistry(Path(registry_root))
runtime = UnexpectedAcceptanceFailure(settings, registry) if mode == "failed" else None
app = create_app(settings, runtime=runtime, registry=registry)
owned = socket.socket()
owned.bind(("127.0.0.1", 0))
Path(ready).write_text(json.dumps({"port": owned.getsockname()[1]}), encoding="utf-8")
uvicorn.Server(uvicorn.Config(app, log_level="warning")).run(sockets=[owned])
