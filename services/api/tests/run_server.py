"""Owned test child uses Uvicorn's graceful stop protocol through private stdin."""

from pathlib import Path
import sys
import threading

import uvicorn

from music_api.config import Settings
from music_api.main import create_app


server = uvicorn.Server(uvicorn.Config(create_app(Settings(data_dir=Path(sys.argv[1]))),
                                      host="127.0.0.1", port=int(sys.argv[2])))


def stop_on_stdin() -> None:
    sys.stdin.buffer.read(1)
    server.should_exit = True


threading.Thread(target=stop_on_stdin, daemon=True).start()
server.run()
