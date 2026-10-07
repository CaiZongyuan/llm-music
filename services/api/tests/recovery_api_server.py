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
cursor_fault = os.environ.get("MUSIC_API_FIXTURE_CURSOR_FAULT")
startup_delay = float(os.environ.get("MUSIC_API_FIXTURE_STARTUP_READ_DELAY","0"))
if cursor_fault or startup_delay:
    from sqlalchemy import event
    from sqlalchemy.engine import Engine
    from sqlalchemy.orm import Session
    from music_api.job_models import Job
    recovery_provider = {"armed":True,"readback":False,"startup":False,"delayed":False}
    def cursor_transition(session):
        for item in session.identity_map.values():
            if not isinstance(item,Job):
                continue
            cursor = item.recovery_cursor or {}
            if item.status in {"queued","running"} and not cursor.get("attempts",0):
                recovery_provider["startup"] = True
            target = cursor.get("attempts",0) >= 1 and item.status in {"queued","running"}
            if cursor_fault == "accept-ack":
                target = target and cursor.get("confirmed") is True
            if cursor_fault == "exhausted-ack":
                target = cursor.get("exhausted") is True and item.status == "failed"
            selected_job = os.environ.get("MUSIC_API_FIXTURE_CURSOR_FAULT_JOB_ID")
            if selected_job and item.id != selected_job:
                target = False
            if cursor_fault and recovery_provider["armed"] and target:
                recovery_provider["armed"] = False
                recovery_provider["readback"] = cursor_fault == "attempt-ack-readback"
                Path(ready).with_suffix(".cursor-fault").write_text("Owned recovery cursor provider fault\n",encoding="utf-8")
                raise RuntimeError("Owned recovery cursor provider acknowledgement fault")
    def cursor_read(connection,cursor,statement,parameters,context,executemany):
        if threading.current_thread().name != "application-jobs" or not statement.startswith("SELECT jobs."):
            return
        if recovery_provider["readback"]:
            recovery_provider["readback"] = False
            Path(ready).with_suffix(".cursor-readback-fault").write_text("Owned recovery cursor readback fault\n",encoding="utf-8")
            raise RuntimeError("Owned recovery cursor independent readback fault")
        if startup_delay and recovery_provider["startup"] and not recovery_provider["delayed"]:
            recovery_provider["delayed"] = True
            began = time.monotonic()
            time.sleep(startup_delay)
            Path(ready).with_suffix(".startup-delay").write_text(str(time.monotonic()-began),encoding="utf-8")
    event.listen(Session,"before_commit" if cursor_fault == "before-attempt" else "after_commit",cursor_transition)
    event.listen(Engine,"before_cursor_execute",cursor_read)
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
