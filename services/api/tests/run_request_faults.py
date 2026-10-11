"""Owned HTTP child injects faults only at its external DB commit boundary."""

from contextvars import ContextVar
import os
from pathlib import Path
import sys
import threading
import time
import socket

import uvicorn
import httpx

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from starlette.datastructures import Headers

from music_api.config import Settings
from music_api.main import create_app
from music_api.workflow_registry import WorkflowRegistry
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.fake_generation import generation_fixture
from music_api.runtime_types import RuntimeStatus


data, url, receipt, registry, port, controls = sys.argv[1:]
control_root = Path(controls)
fault = ContextVar("request_commit_fault", default="")


def before_commit(session: Session) -> None:
    mode = fault.get()
    if mode == "before":
        fault.set("")
        raise OSError("Isolated commit provider refused before commit")
    if mode == "hold":
        fault.set("")
        (control_root / "held").write_text("Owned request commit held", encoding="utf-8")
        deadline = time.monotonic() + 10
        while not (control_root / "release").exists():
            assert time.monotonic() < deadline, "Owned database commit gate exceeded its bounded test budget"
            threading.Event().wait(0.01)


def after_commit(session: Session) -> None:
    mode = fault.get()
    if mode in {"after", "after-readback", "crash"}:
        fault.set("readback-once" if mode == "after-readback" else "")
        (control_root / "committed").write_text("Owned request commit acknowledged by database", encoding="utf-8")
        if mode == "crash":
            os._exit(77)
        raise OSError("Isolated durable commit acknowledgement was lost")


def before_cursor(connection, cursor, statement, parameters, context, executemany):
    if fault.get() == "readback-once" and statement.startswith("SELECT client_requests."):
        fault.set("")
        (control_root / "readback-failed").write_text("One isolated receipt read failed", encoding="utf-8")
        raise OperationalError("Isolated receipt readback unavailable", None, OSError("One receipt read failure"))


event.listen(Session, "before_commit", before_commit)
event.listen(Session, "after_commit", after_commit)
event.listen(Engine, "before_cursor_execute", before_cursor)
configured = Settings(data_dir=Path(data), runtime_mode="fake", local_port=int(port),
                      recovery_confirmation_window_seconds=0.4, recovery_max_attempts=3,
                      recovery_poll_interval_seconds=0.02, recovery_max_poll_interval_seconds=0.05)
with socket.socket() as owned:
    owned.bind(("127.0.0.1", int(port)))
    host, actual_port = owned.getsockname()
    selected_registry = WorkflowRegistry(Path(registry))

    class RecordedFake(FakeInferenceRuntime):
        def submit(self, request):
            accepted = super().submit(request)
            with httpx.Client(base_url=url, trust_env=False, timeout=3) as peer:
                peer.post("/fixture/record", json={"handle": accepted.handle, "attempt_id": str(request.attempt_id)}).raise_for_status()
            return accepted

        def status(self, handle):
            with httpx.Client(base_url=url, trust_env=False, timeout=3) as peer:
                current = peer.get("/fixture/state").json()["jobs"][handle]
            return RuntimeStatus("completed") if current["complete"] else RuntimeStatus("running", "synthesizing")

    runtime = RecordedFake(registry=selected_registry, result_factories={"Generate": generation_fixture})
    app = create_app(configured, runtime=runtime, registry=selected_registry, listener_bindings={(host, actual_port): "local"})

    async def scoped_provider(scope, receive, send):
        token = fault.set(Headers(scope=scope).get("x-fixture-fault", "") if scope["type"] == "http" else "")
        try:
            await app(scope, receive, send)
        finally:
            fault.reset(token)

    server = uvicorn.Server(uvicorn.Config(scoped_provider, proxy_headers=False, access_log=False))

    def stop_on_stdin() -> None:
        sys.stdin.buffer.read(1)
        server.should_exit = True

    threading.Thread(target=stop_on_stdin, daemon=True).start()
    server.run(sockets=[owned])
