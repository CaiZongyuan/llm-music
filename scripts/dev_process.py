"""Local process identities shared by the launcher and its owned workers."""

import json
import os
from pathlib import Path

import psutil


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def identity(pid: int) -> dict:
    process = psutil.Process(pid)
    return dict(pid=pid, create_time=process.create_time(), executable=process.exe(),
                command=process.cmdline(), cwd=str(Path(process.cwd()).resolve()))


def matching(value: dict) -> psutil.Process | None:
    try:
        actual = identity(value["pid"])
        return psutil.Process(value["pid"]) if actual == value else None
    except (psutil.Error, OSError, KeyError, TypeError):
        return None


def listeners(port: int) -> set[int | None]:
    return {item.pid for item in psutil.net_connections(kind="tcp")
            if item.status == psutil.CONN_LISTEN and item.laddr.port == port}


def stop_requested(config: dict) -> bool:
    try:
        return Path(config["stop_file"]).read_text(encoding="utf-8") == config["stop_token"]
    except FileNotFoundError:
        return False


def announce(config: dict, **facts: object) -> None:
    write_json(Path(config["owner_file"]), dict(process=identity(os.getpid()), config=config, **facts))
