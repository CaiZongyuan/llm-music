"""Own a loopback API server and acknowledge a token-bound graceful stop."""

import json
from pathlib import Path
import sys
import threading

from music_api.config import Settings
from music_api.serving import bound_server
from dev_process import announce, stop_requested, write_json


def main() -> None:
    config = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if Path(sys.prefix).resolve() != Path(config["python_environment"]).resolve():
        raise ValueError("API environment differs from its independent uv project")
    configured = Settings(data_dir=Path(config["data_dir"]), runtime_mode=config["mode"],
                          runtime_url=config["runtime_url"], runtime_evidence_path=config["runtime_evidence"],
                          local_port=config["port"], lan_host=config.get("lan_host"), lan_port=config.get("lan_port", 8001),
                          owner_origins=config.get("owner_origins", ["http://127.0.0.1:5173", "http://localhost:5173"]))
    with bound_server(configured) as (server, sockets):
        announce(config, python_environment=sys.prefix, runtime_mode=configured.runtime_mode,
                 listener_bindings=[dict(host=value.getsockname()[0], port=value.getsockname()[1]) for value in sockets])

        def watch() -> None:
            while not server.should_exit:
                if stop_requested(config):
                    server.should_exit = True
                    return
                threading.Event().wait(0.1)

        threading.Thread(target=watch, daemon=True).start()
        server.run(sockets=sockets)
        write_json(Path(config["stopped_file"]), dict(graceful=server.started, service="api"))


if __name__ == "__main__":
    main()
