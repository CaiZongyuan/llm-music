"""Own a loopback API server and acknowledge a token-bound graceful stop."""

import json
from pathlib import Path
import sys
import threading

import uvicorn

from music_api.config import Settings
from music_api.main import create_app
from dev_process import announce, stop_requested, write_json


def main() -> None:
    config = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if Path(sys.prefix).resolve() != Path(config["python_environment"]).resolve():
        raise ValueError("API environment differs from its independent uv project")
    configured = Settings(data_dir=Path(config["data_dir"]), runtime_mode=config["mode"],
                          runtime_url=config["runtime_url"], runtime_evidence_path=config["runtime_evidence"])
    server = uvicorn.Server(uvicorn.Config(create_app(configured), host="127.0.0.1", port=config["port"]))
    announce(config, python_environment=sys.prefix, runtime_mode=configured.runtime_mode)

    def watch() -> None:
        while not server.should_exit:
            if stop_requested(config):
                server.should_exit = True
                return
            threading.Event().wait(0.1)

    threading.Thread(target=watch, daemon=True).start()
    server.run()
    write_json(Path(config["stopped_file"]), dict(graceful=server.started, service="api"))


if __name__ == "__main__":
    main()
