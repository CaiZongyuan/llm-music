"""Owned CPU fixture controls; production FastAPI, JobService and SQLite are unchanged."""

from datetime import datetime, timezone, timedelta
from dataclasses import replace
import importlib.util
import json
import logging
import os
from pathlib import Path
import threading
from typing import Literal

import psutil
import uvicorn
from pydantic import BaseModel

from music_api.config import Settings
from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from music_api.runtime_types import RuntimeStatus


class Observation(BaseModel):
    state: Literal['queued', 'running', 'completed', 'failed', 'cancelled', 'unconfirmed']
    phase: str | None = None
    progress: float | None = None
    code: str | None = None


class Readiness(BaseModel):
    state: Literal['ready', 'model_missing', 'runtime_unavailable', 'stale']


class ControlledFake(FakeInferenceRuntime):
    def __init__(self) -> None:
        super().__init__(result_factories={"Generate": generation_fixture})
        self.observations: dict[str, RuntimeStatus] = {}
        self.readiness = 'ready'

    def health(self):
        observation = super().health()
        if self.readiness == 'runtime_unavailable':
            return replace(observation, reachable=False, reasons=('runtime_unavailable',))
        if self.readiness == 'stale':
            return replace(observation, observed_at=datetime.now(timezone.utc) - timedelta(hours=1))
        return observation

    def capabilities(self, observation=None):
        values = super().capabilities(observation)
        return tuple(replace(value, ready=False, reasons=('model_missing',)) for value in values) if self.readiness == 'model_missing' else values

    def status(self, handle: str) -> RuntimeStatus:
        inputs = self._requests[handle][0].inputs
        identity = str(inputs.get('reference_asset_id', inputs.get('seed', '0')))
        return self.observations.get(identity, super().status(handle))

    def cancel(self, handle: str) -> RuntimeStatus:
        # Dispatch acknowledged while confirmation is still pending. The test
        # changes the independent Runtime observation to confirm or race completion.
        return self.status(handle)

    def subscribe(self, handle, operation, on_status):
        stopped = threading.Event()

        def watch():
            previous = None
            while not stopped.is_set():
                value = self.status(handle)
                if value != previous:
                    on_status(RuntimeStatus("unconfirmed", code="native_event_source_lost") if value.state == "running" and value.phase is None else value)
                    previous = value
                if value.state in {"completed", "failed", "cancelled"}:
                    return
                stopped.wait(0.01)

        thread = threading.Thread(target=watch, daemon=True)
        thread.start()

        def close():
            stopped.set()
            thread.join(timeout=2)

        return close


def main() -> None:
    run_dir = Path(os.environ["MUSIC_BROWSER_RUN_DIR"]).resolve()
    if run_dir.parent != Path(__file__).resolve().parent / ".artifacts" or run_dir.exists():
        raise ValueError("Jobs fixture requires a new owned browser artifact directory")
    if importlib.util.find_spec("torch") is not None:
        raise RuntimeError("Jobs browser fixture must use the independent CPU environment")
    port = int(os.environ["MUSIC_BROWSER_PORT"])
    if port in {8188, 18032}:
        raise ValueError("Cannot use the preview or shared Runtime port")
    run_dir.mkdir(parents=True)
    runtime = ControlledFake()
    app = create_app(Settings(data_dir=run_dir / "application", runtime_mode="fake", runtime_evidence_path=None), runtime)

    @app.post("/__fixtures/observations/{identity}")
    def observe(identity: str, value: Observation) -> dict[str, str]:
        runtime.observations[identity] = RuntimeStatus(value.state, value.phase, value.progress, value.code)
        return {"scope": "CPU FakeRuntime control only; no model inference"}

    @app.get("/__fixtures/observations/{identity}")
    def observation(identity: str) -> dict[str, str | None]:
        value = runtime.observations.get(identity)
        return {'state': None if value is None else value.state}

    @app.post("/__fixtures/readiness")
    def readiness(value: Readiness) -> dict[str, str]:
        runtime.readiness = value.state
        return {'scope': 'Controlled CPU readiness fixture; no model verification'}

    owner = {"pid": os.getpid(), "create_time": psutil.Process().create_time(), "argv": psutil.Process().cmdline(),
             "port": port, "runtime_mode": "fake", "torch_installed": False, "data_dir": str(run_dir / "application"),
             "started_at": datetime.now(timezone.utc).isoformat()}
    (run_dir / "owner.json").write_text(json.dumps(owner, indent=2) + "\n", encoding="utf-8")
    config = uvicorn.Config(app, host="127.0.0.1", port=port)
    handler = logging.FileHandler(run_dir / "api.log", encoding="utf-8")
    for name in ["uvicorn", "uvicorn.error", "uvicorn.access", "music_api"]:
        logging.getLogger(name).addHandler(handler)
    server = uvicorn.Server(config)

    def watch_stop() -> None:
        while not server.should_exit:
            if (run_dir / "stop").exists():
                server.should_exit = True
                return
            threading.Event().wait(0.1)

    threading.Thread(target=watch_stop, daemon=True).start()
    server.run()
    handler.flush()
    (run_dir / "stopped.json").write_text(json.dumps({**owner, "graceful": "Application shutdown complete." in (run_dir / "api.log").read_text(encoding="utf-8"),
                                                       "stopped_at": datetime.now(timezone.utc).isoformat()}, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
