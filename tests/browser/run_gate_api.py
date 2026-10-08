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
import uvicorn

from music_api.config import Settings
from music_api.main import create_app


def record(path, value):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def serve(run_dir, port, generation, stop):
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
    process = None
    stop = None

    def start(generation):
        event = context.Event()
        child = context.Process(target=serve, args=(run_dir, port, generation, event))
        child.start()
        children.append({"pid": child.pid, "generation": generation})
        return child, event

    def finish():
        stop.set()
        process.join(10)
        if process.is_alive() or process.exitcode != 0:
            raise RuntimeError("Owned API child did not finish its normal shutdown")

    try:
        process, stop = start(0)
        while not (run_dir / "stop").exists():
            if process.exitcode is not None:
                raise RuntimeError("Owned API exited before the gate requested shutdown")
            if (run_dir / "restart").exists():
                finish()
                previous = json.loads((run_dir / "api-0-stopped.json").read_text(encoding="utf-8"))
                if not previous["graceful"]:
                    raise RuntimeError("Initial API shutdown was not acknowledged")
                record(run_dir / "restart-stopped.json", previous)
                while not (run_dir / "resume").exists() and not (run_dir / "stop").exists():
                    time.sleep(0.1)
                if (run_dir / "stop").exists():
                    break
                (run_dir / "restart").unlink()
                process, stop = start(1)
            time.sleep(0.1)
    finally:
        if process is not None:
            finish()
        receipts = [json.loads((run_dir / f"api-{child['generation']}-stopped.json").read_text(encoding="utf-8")) for child in children]
        record(run_dir / "stopped.json", {"pid": os.getpid(), "port": port,
               "graceful": all(receipt["graceful"] for receipt in receipts), "children": receipts})


if __name__ == "__main__":
    main()
