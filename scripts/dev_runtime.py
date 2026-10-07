"""Own a newly started native Runtime; never receives a reused Runtime PID."""

import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

import psutil

from dev_process import announce, identity, matching, stop_requested, write_json


def main() -> int:
    config = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if Path(sys.prefix).resolve() != Path(config["python_environment"]).resolve():
        raise ValueError("Runtime must use its independent pinned uv environment")
    command = [sys.executable, str(Path(config["runtime_project"]) / "manage.py"), "start",
               "--runtime-root", config["runtime_root"], "--models-root", config["models_root"],
               "--state-root", config["runtime_state_root"], "--port", str(config["port"])]
    child = subprocess.Popen(command, cwd=config["root"],
                             creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0)
    owned = {child.pid: identity(child.pid)}
    announce(config, python_environment=sys.prefix, child=owned[child.pid])
    try:
        while child.poll() is None:
            try:
                children = psutil.Process(child.pid).children(recursive=True)
            except psutil.NoSuchProcess:
                break
            for process in children:
                try:
                    owned.setdefault(process.pid, identity(process.pid))
                except psutil.Error:
                    pass
            if stop_requested(config):
                break
            time.sleep(0.1)
    finally:
        if child.poll() is None:
            try:
                child.send_signal(signal.CTRL_BREAK_EVENT if os.name == "nt" else signal.SIGINT)
            except OSError:
                pass  # Bounded fallback below still requires exact owned identities.
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline and any(matching(item) for item in owned.values()):
            time.sleep(0.1)
        remaining = [process for item in owned.values() if (process := matching(item)) is not None]
        graceful = not remaining
        for process in reversed(remaining):
            process.terminate()
        _, alive = psutil.wait_procs(remaining, timeout=2)
        for process in alive:
            if matching(owned[process.pid]):
                process.kill()
        write_json(Path(config["stopped_file"]), dict(graceful=graceful, service="runtime", forced_pids=[item.pid for item in remaining]))
    return child.wait(timeout=3)


if __name__ == "__main__":
    raise SystemExit(main())
