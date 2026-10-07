"""Verify a live Python launch path without inferring sys.prefix from a base exe."""

import hashlib
import os
from pathlib import Path

import psutil

from dev_process import identity, matching


def launch_path(value: str, cwd: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = Path(cwd) / path
    # Preserve the interpreter symlink name on Unix; resolving the file itself
    # would collapse separate venvs onto the common base executable again.
    return path.parent.resolve() / path.name


def interpreter_origin(pid: int, project: Path) -> dict:
    project = project.resolve()
    executable = project / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not executable.is_file() or not (project / "uv.lock").is_file():
        raise ValueError("Runtime origin environment/lock is not prepared")
    listener = identity(pid)
    process = matching(listener)
    if process is None:
        raise ValueError("Runtime listener identity changed during origin verification")

    def launched_by(value: dict) -> bool:
        return bool(value["command"]) and launch_path(value["command"][0], value["cwd"]) == executable \
            and Path(value["executable"]).resolve() == executable.resolve()

    creator = listener
    scope = "live direct interpreter launch path"
    if not launched_by(listener):
        # The immediate Windows redirector must launch this exact command. A
        # distant ancestor using the right venv does not prove a child's env.
        parent = process.parent()
        if os.name != "nt" or parent is None:
            raise ValueError("Runtime environment origin is unproved; preserve the external service and use its verified live creator")
        creator = identity(parent.pid)
        if not launched_by(creator) or creator["command"][1:] != listener["command"][1:] \
                or creator["create_time"] > listener["create_time"]:
            raise ValueError("Runtime environment origin differs from the requested uv project; no reused process was changed")
        scope = "live immediate Windows venv redirector launching the exact listener command"
    if matching(listener) is None or matching(creator) is None or (creator != listener and psutil.Process(pid).ppid() != creator["pid"]):
        raise ValueError("Runtime creator/listener identity changed during origin verification")
    return dict(verified=True, scope=scope, listener=listener, creator=creator, launch_environment=str(project / ".venv"),
                project=str(project), lock_sha256=hashlib.sha256((project / "uv.lock").read_bytes()).hexdigest())
