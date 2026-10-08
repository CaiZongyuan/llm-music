"""Public supervisor failure receipt and owned-process cleanup, without a listener."""

import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
from uuid import uuid4

import psutil


ROOT = Path(__file__).resolve().parents[2]


def identity(process):
    return {"pid": process.pid, "create_time": process.create_time(), "parent_pid": process.ppid(),
            "argv": process.cmdline(), "cwd": process.cwd()}


def matching(value):
    try:
        process = psutil.Process(value["pid"])
        actual = identity(process)
        return process if actual == {key: value[key] for key in actual} else None
    except psutil.NoSuchProcess:
        return None


def ignore_stop(run_dir, port, generation, stop):
    process = psutil.Process()
    (run_dir / "stall-owner.json").write_text(json.dumps({
        **identity(process), "generation": generation,
        "port": port, "no_listener": True}), encoding="utf-8")
    threading.Event().wait()  # The normal Event is deliberately never observed.


def test_restart_shutdown_stall_fails_boundedly_and_retains_forced_cleanup():
    (ROOT / "tests/browser/.artifacts").mkdir(parents=True, exist_ok=True)
    run_dir = ROOT / "tests/browser/.artifacts" / f"gate-stop-stall-{uuid4()}"
    environment = {**os.environ, "MUSIC_BROWSER_RUN_DIR": str(run_dir), "MUSIC_BROWSER_PORT": "29987"}
    log_path = run_dir.with_suffix(".log")
    began = time.monotonic()
    child_identity = None
    worker_identity = None
    with log_path.open("w", encoding="utf-8") as output:
        supervisor = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "--stall-worker"],
                                      cwd=ROOT, env=environment, stdout=output, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 10
            owner = run_dir / "stall-owner.json"
            while not owner.exists():
                assert supervisor.poll() is None, log_path.read_text(encoding="utf-8")
                assert time.monotonic() < deadline, "Owned no-port child did not announce itself"
                time.sleep(0.05)
            child_identity = json.loads(owner.read_text(encoding="utf-8"))
            worker_identity = json.loads(run_dir.with_suffix(".supervisor.json").read_text(encoding="utf-8"))
            worker = matching(worker_identity)
            assert worker is not None
            assert worker.pid == supervisor.pid or worker.ppid() == supervisor.pid  # Windows venv redirector.
            assert child_identity["parent_pid"] == worker.pid
            assert not [c for c in psutil.net_connections(kind="tcp") if c.pid == child_identity["pid"] and c.status == psutil.CONN_LISTEN]
            (run_dir / "restart").write_text("Exercise failed restart finish and final cleanup\n", encoding="utf-8")
            assert supervisor.wait(timeout=18) != 0
            receipt = json.loads((run_dir / "stopped.json").read_text(encoding="utf-8"))
            assert receipt["graceful"] is False and receipt["forced_cleanup"] is True and receipt["cleanup_complete"] is True
            assert len(receipt["children"]) == 1
            child = receipt["children"][0]
            assert child["pid"] == child_identity["pid"] and child["create_time"] == child_identity["create_time"]
            assert child["graceful"] is False and child["acknowledgement"] is None
            assert child["forced_actions"] == ["terminate"] and child["exitcode"] != 0 and child["errors"] == []
            assert not (run_dir / "restart-stopped.json").exists()  # No resumed success or second child.
            assert not (run_dir / "api-0-stopped.json").exists()  # No forged normal acknowledgement.
            cleanup = json.loads((run_dir / "api-0-cleanup.json").read_text(encoding="utf-8"))
            assert cleanup == child
            assert time.monotonic() - began < 25
            assert not psutil.pid_exists(child_identity["pid"])
            assert not [c for c in psutil.net_connections(kind="tcp") if c.pid == child_identity["pid"] and c.status == psutil.CONN_LISTEN]
        finally:
            # Only this directly spawned supervisor/announced child can be reclaimed
            # if the regression fails. Never follow arbitrary receipt PIDs.
            if child_identity:
                child = matching(child_identity)
                if child and worker_identity and child.ppid() == worker_identity["pid"]:
                    child.kill()
                    child.wait(3)
            if worker_identity:
                worker = matching(worker_identity)
                if worker:
                    worker.kill()
                    worker.wait(3)
            if supervisor.poll() is None:
                supervisor.kill()
                supervisor.wait(3)


if __name__ == "__main__" and sys.argv[1:] == ["--stall-worker"]:
    run_dir = Path(os.environ["MUSIC_BROWSER_RUN_DIR"])
    run_dir.with_suffix(".supervisor.json").write_text(json.dumps(identity(psutil.Process())), encoding="utf-8")
    import run_gate_api
    run_gate_api.serve = ignore_stop
    run_gate_api.main()
