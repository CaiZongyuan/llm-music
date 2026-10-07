"""Actual production API child owns its socket/data and closes through a private file."""
import json
import os
from pathlib import Path
import socket
import sys
import threading
import time

if os.environ.get("MUSIC_API_FIXTURE_SOURCE_PATH"):
    sys.path.insert(0,os.environ["MUSIC_API_FIXTURE_SOURCE_PATH"])

import uvicorn
from music_api.config import Settings
from music_api.main import create_app
from music_api.workflow_registry import WorkflowRegistry

data, url, receipt, registry, ready = sys.argv[1:]
selected_registry = WorkflowRegistry(Path(registry))
if url == "fake":
    from persistent_fake_runtime import PersistentFake
    app = create_app(Settings(data_dir=Path(data),runtime_mode="fake"),runtime=PersistentFake(Path(receipt),selected_registry),registry=selected_registry)
else:
    app = create_app(Settings(data_dir=Path(data),runtime_mode="comfyui",runtime_url=url,runtime_evidence_path=Path(receipt)),registry=selected_registry)
fault = os.environ.get("MUSIC_API_FIXTURE_IMPORT_FAULT")
if fault:
    from sqlalchemy import event
    from sqlalchemy.engine import Engine
    from sqlalchemy.orm import Session
    from music_api.job_models import Job
    armed = {"commit":True,"readback":False}
    def fail_commit(session):
        if armed["commit"] and any(isinstance(item,Job) and item.status == "completed" for item in session.identity_map.values()):
            armed["commit"] = False
            armed["readback"] = fault == "commit-readback"
            Path(ready).with_suffix(".fault").write_text("Owned result provider commit fault\n",encoding="utf-8")
            raise RuntimeError("Owned result provider fault")
    def fail_readback(connection,cursor,statement,parameters,context,executemany):
        if armed["readback"] and statement.startswith("SELECT jobs.status"):
            armed["readback"] = False
            Path(ready).with_suffix(".readback-fault").write_text("Owned independent readback fault\n",encoding="utf-8")
            raise RuntimeError("Owned result provider independent readback fault")
    event.listen(Session,"before_commit" if fault == "before-commit" else "after_commit",fail_commit)
    event.listen(Engine,"before_cursor_execute",fail_readback)
owned = socket.socket()
owned.bind(("127.0.0.1",0))
Path(ready).write_text(json.dumps({"port":owned.getsockname()[1],"pid":os.getpid()}),encoding="utf-8")
server = uvicorn.Server(uvicorn.Config(app,log_level="warning"))
def stop():
    while not server.should_exit:
        if Path(ready).with_suffix(".stop").exists():
            server.should_exit = True
            return
        time.sleep(0.05)
threading.Thread(target=stop,daemon=True).start()
server.run(sockets=[owned])
