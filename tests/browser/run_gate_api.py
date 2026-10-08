"""Restart an owned CPU API process while retaining its real SQLite and Assets."""

from datetime import datetime, timezone
import importlib.util
import json
import logging
import multiprocessing
import os
from pathlib import Path
import subprocess
import threading
import time

import psutil


class OwnedProcess(multiprocessing.context.SpawnProcess):
    def join(self, timeout=None):
        # CPython also joins live children during exception-driven interpreter
        # exit. That implicit join must not turn a failed cleanup into a hang.
        super().join(2 if timeout is None else timeout)


def record(path, value):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def serve(run_dir, port, generation, stop):
    import uvicorn

    from music_api.config import Settings
    from music_api.main import create_app

    log_path = run_dir / f"api-{generation}.log"
    handler = logging.FileHandler(log_path, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    owner = {"pid": os.getpid(), "parent_pid": os.getppid(), "port": port,
             "create_time": psutil.Process().create_time(), "argv": psutil.Process().cmdline(),
             "source": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=Path(__file__).resolve().parents[2], text=True).strip(),
             "runtime_mode": "fake", "torch_installed": False, "generation": generation,
             "data_dir": str(run_dir / "application"),
             "started_at": datetime.now(timezone.utc).isoformat()}
    record(run_dir / "owner.json", owner)
    record(run_dir / f"api-{generation}-owner.json", owner)
    server = uvicorn.Server(uvicorn.Config(
        create_app(Settings(data_dir=run_dir / "application", runtime_mode="fake", runtime_evidence_path=None)),
        host="127.0.0.1", port=port))
    for name in ["uvicorn", "uvicorn.error", "uvicorn.access", "music_api"]:
        logging.getLogger(name).addHandler(handler)

    def watch():
        stop.wait()
        server.should_exit = True

    threading.Thread(target=watch, daemon=True).start()
    server.run()
    handler.flush()
    record(run_dir / f"api-{generation}-stopped.json", {
        **owner, "graceful": "Application shutdown complete." in log_path.read_text(encoding="utf-8"),
        "stopped_at": datetime.now(timezone.utc).isoformat()})


def stop_child(owned, run_dir):
    if "receipt" in owned:
        return owned["receipt"]
    process, event, identity = owned["process"], owned["event"], owned["identity"]
    forced = []
    errors = []

    def same_child():
        if not process.is_alive():
            return False
        try:
            actual = psutil.Process(process.pid)
            return actual.create_time() == identity["create_time"] and actual.ppid() == identity["parent_pid"]
        except psutil.Error:
            return False

    try:
        event.set()
        process.join(10)
        for action in ["terminate", "kill"]:
            if not process.is_alive():
                break
            if not same_child():
                errors.append("Owned child birth/parent identity could not be confirmed; no signal sent")
                break
            getattr(process, action)()
            forced.append(action)
            process.join(2)
    except (OSError, ValueError) as error:
        errors.append(str(error))
    path = run_dir / f"api-{identity['generation']}-stopped.json"
    acknowledgement = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
    matching_ack = acknowledgement and acknowledgement.get("pid") == identity["pid"] \
        and acknowledgement.get("create_time") == identity["create_time"]
    receipt = {**(acknowledgement or {}), **identity, "graceful": bool(matching_ack and acknowledgement.get("graceful")
               and not forced and not errors and not process.is_alive() and process.exitcode == 0),
               "forced_cleanup": bool(forced), "forced_actions": forced, "errors": errors,
               "cleanup_complete": not process.is_alive(), "exitcode": process.exitcode,
               "acknowledgement": acknowledgement, "stopped_at": datetime.now(timezone.utc).isoformat()}
    record(run_dir / f"api-{identity['generation']}-cleanup.json", receipt)
    owned["receipt"] = receipt
    return receipt


def main():
    run_dir = Path(os.environ["MUSIC_BROWSER_RUN_DIR"]).resolve()
    if run_dir.parent != Path(__file__).resolve().parent / ".artifacts" or run_dir.exists():
        raise ValueError("P2 gate API requires a new direct child of its owned .artifacts directory")
    if importlib.util.find_spec("torch") is not None:
        raise RuntimeError("P2 gate uses the independent CPU application environment")
    port = int(os.environ["MUSIC_BROWSER_PORT"])
    if not 1 <= port <= 65535 or port in {8188, 18030, 18031, 18032, 18033}:
        raise ValueError("Invalid owned API port")
    run_dir.mkdir(parents=True)
    context = multiprocessing.get_context("spawn")
    children = []
    current = None

    def start(generation):
        event = context.Event()
        child = OwnedProcess(target=serve, args=(run_dir, port, generation, event))
        child.start()
        owned = {"process": child, "event": event, "identity": {
            "pid": child.pid, "create_time": psutil.Process(child.pid).create_time(),
            "parent_pid": os.getpid(), "generation": generation, "port": port,
            "data_dir": str(run_dir / "application")}}
        children.append(owned)
        return owned

    def finish():
        receipt = stop_child(current, run_dir)
        if not receipt["graceful"]:
            raise RuntimeError("Owned API child did not finish its normal shutdown")
        return receipt

    try:
        current = start(0)
        while not (run_dir / "stop").exists():
            if current["process"].exitcode is not None:
                raise RuntimeError("Owned API exited before the gate requested shutdown")
            if (run_dir / "restart").exists():
                previous = finish()
                record(run_dir / "restart-stopped.json", previous)
                while not (run_dir / "resume").exists() and not (run_dir / "stop").exists():
                    time.sleep(0.1)
                if (run_dir / "stop").exists():
                    break
                (run_dir / "restart").unlink()
                current = start(1)
            time.sleep(0.1)
    finally:
        receipts = [stop_child(child, run_dir) for child in children]
        record(run_dir / "stopped.json", {"pid": os.getpid(), "port": port,
               "graceful": bool(receipts) and all(receipt["graceful"] for receipt in receipts),
               "forced_cleanup": any(receipt["forced_cleanup"] for receipt in receipts),
               "cleanup_complete": all(receipt["cleanup_complete"] for receipt in receipts), "children": receipts})
        if any(not receipt["graceful"] for receipt in receipts):
            raise RuntimeError("Owned API cleanup failed; inspect the truthful stopped receipt")


if __name__ == "__main__":
    main()
