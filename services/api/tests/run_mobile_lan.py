"""Isolated real-socket peer with owned stdin shutdown, never product data."""

from pathlib import Path
import sys
import threading
import socket

from music_api.config import Settings
from music_api.serving import bound_server
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.fake_generation import generation_fixture
from music_api.runtime_types import RuntimeStatus


class ControlledRuntime(FakeInferenceRuntime):
    def status(self, handle: str) -> RuntimeStatus:
        if len(sys.argv) > 5 and sys.argv[5] != "-" and not Path(sys.argv[5]).exists():
            return RuntimeStatus("running", "synthesizing")
        return super().status(handle)


configured = Settings(data_dir=Path(sys.argv[1]), lan_host=sys.argv[2], local_port=int(sys.argv[3]), lan_port=int(sys.argv[4]), runtime_mode="fake")
runtime = ControlledRuntime(result_factories={"Generate": generation_fixture})
with bound_server(configured, runtime=runtime) as (server, sockets):
    def stop_on_stdin() -> None:
        sys.stdin.buffer.read(1)
        server.should_exit = True
    threading.Thread(target=stop_on_stdin, daemon=True).start()
    if len(sys.argv) > 6:
        # An intentionally unregistered actual socket proves fail-closed origin.
        with socket.socket() as unknown:
            unknown.bind(("127.0.0.1", int(sys.argv[6])))
            server.run(sockets=[*sockets, unknown])
    else:
        server.run(sockets=sockets)
