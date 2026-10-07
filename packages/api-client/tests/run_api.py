"""Owned CPU-only production API; Runtime gates are files, never business routes."""

import argparse
from dataclasses import replace
from datetime import datetime, timezone
import importlib.util
import json
import logging
import os
from pathlib import Path
import socket
import threading

import psutil
import uvicorn

from music_api.config import Settings
from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from music_api.runtime_types import RuntimeObservation, RuntimeRequest, RuntimeStatus, SubmissionReceipt


class ClientFixtureRuntime(FakeInferenceRuntime):
    def __init__(self, run_dir: Path, unavailable: bool) -> None:
        super().__init__(result_factories={"Generate": generation_fixture})
        self.run_dir, self.unavailable = run_dir, unavailable
        self.requests: dict[str, RuntimeRequest] = {}
        self.failed_once = False
        self.failing_handle: str | None = None
        self.cancel_started: set[str] = set()

    def health(self) -> RuntimeObservation:
        observation = super().health()
        return replace(observation, reachable=False, registered_nodes=None, reasons=("runtime_unavailable",)) if self.unavailable else observation

    def submit(self, request: RuntimeRequest) -> SubmissionReceipt:
        receipt = super().submit(request)
        if receipt.handle is not None:
            self.requests[receipt.handle] = request
            if request.inputs.get("seed") == 2026271003 and not self.failed_once:
                self.failed_once, self.failing_handle = True, receipt.handle
        return receipt

    def status(self, handle: str) -> RuntimeStatus:
        original = super().status(handle)
        if original.state == "cancelled":
            return original
        if handle in self.cancel_started and (self.run_dir / "confirm-cancel").exists():
            return RuntimeStatus("cancelled", code="cancelled")
        request = self.requests[handle]
        if handle == self.failing_handle:
            return RuntimeStatus("failed", code="runtime_execution_failed", message="Private CPU failure fixture")
        seed = request.inputs.get("seed")
        gate = "release-transcribe" if request.operation == "Transcribe" else {
            2026271001: "release-generate", 2026271002: "release-cancel",
        }.get(seed if isinstance(seed, int) else -1)
        if gate is not None and not (self.run_dir / gate).exists():
            return RuntimeStatus("running", "transcribing" if request.operation == "Transcribe" else "planning_score", None)
        return original

    def cancel(self, handle: str) -> RuntimeStatus:
        if self.requests[handle].inputs.get("seed") == 2026271002 and not (self.run_dir / "confirm-cancel").exists():
            self.cancel_started.add(handle)
            return RuntimeStatus("running", "planning_score")
        return super().cancel(handle)


def write_record(path: Path, value: dict[str, object]) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def stop_owned(run_dir: Path) -> None:
    artifacts = Path(os.environ["MUSIC_CLIENT_ARTIFACTS"]).resolve()
    run_dir = run_dir.resolve()
    if run_dir.parent != artifacts:
        raise ValueError("Cleanup is restricted to a direct owned artifact directory")
    owner = json.loads((run_dir / "owner.json").read_bytes())
    process = psutil.Process(owner["pid"])
    expected = str(Path(__file__).resolve())
    arguments = process.cmdline()
    if process.create_time() != owner["process_created_at"] or expected not in arguments or str(run_dir) not in arguments:
        raise ValueError("Cleanup refused: API process identity differs from its owner receipt")
    process.terminate()
    try:
        process.wait(timeout=5)
    except psutil.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
    write_record(run_dir / "forced-stop.json", {"pid": owner["pid"], "process_created_at": owner["process_created_at"],
                                               "identity_verified": True, "stopped_at": datetime.now(timezone.utc).isoformat()})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stop-owner", type=Path)
    parser.add_argument("--run-dir", type=Path)
    parser.add_argument("--data-dir", type=Path)
    parser.add_argument("--unavailable", action="store_true")
    args = parser.parse_args()
    if args.stop_owner is not None:
        stop_owned(args.stop_owner)
        return
    if args.run_dir is None or args.data_dir is None:
        parser.error("--run-dir and --data-dir are required for an API launch")
    run_dir, data_dir = args.run_dir.resolve(), args.data_dir.resolve()
    artifacts = Path(os.environ["MUSIC_CLIENT_ARTIFACTS"]).resolve()
    if run_dir.parent != artifacts or not run_dir.is_dir() or not data_dir.is_relative_to(artifacts):
        raise ValueError("Client API requires its owned run and data directories")
    if importlib.util.find_spec("torch") is not None:
        raise RuntimeError("Client tests require the independent CPU API environment")
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.bind(("127.0.0.1", 0))
    port = listener.getsockname()[1]
    if port == 8188:
        listener.close()
        raise RuntimeError("Client fixture may not use the retained Runtime port")
    listener.listen(128)
    owner: dict[str, object] = dict(pid=os.getpid(), parent_pid=os.getppid(), process_created_at=psutil.Process().create_time(),
                                   port=port, runtime_mode="fake", torch_installed=False, data_dir=str(data_dir),
                                   started_at=datetime.now(timezone.utc).isoformat())
    write_record(run_dir / "owner.json", owner)
    handler = logging.FileHandler(run_dir / "api.log", encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    app = create_app(Settings(data_dir=data_dir, runtime_mode="fake", runtime_url="http://127.0.0.1:1", runtime_evidence_path=None),
                     runtime=ClientFixtureRuntime(run_dir, args.unavailable))
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port))
    for name in ["uvicorn", "uvicorn.error", "uvicorn.access", "music_api"]:
        logging.getLogger(name).addHandler(handler)
    stop_watcher = threading.Event()

    def watch() -> None:
        ready = False
        while not stop_watcher.wait(0.02):
            if server.started and not ready:
                write_record(run_dir / "ready.json", owner)
                ready = True
            if (run_dir / "stop").exists():
                server.should_exit = True
                return

    watcher = threading.Thread(target=watch, daemon=True, name="client-fixture-owner")
    watcher.start()
    try:
        server.run(sockets=[listener])
    finally:
        stop_watcher.set()
        watcher.join(timeout=2)
        listener.close()
        handler.flush()
        write_record(run_dir / "stopped.json", {
            **owner, "stopped_at": datetime.now(timezone.utc).isoformat(),
            "graceful": "Application shutdown complete." in (run_dir / "api.log").read_text(encoding="utf-8"),
        })
        handler.close()


if __name__ == "__main__":
    main()
