"""Bind precise owned sockets before starting one application lifespan."""

from collections.abc import Iterator
from contextlib import contextmanager
import socket
import logging

import psutil
import uvicorn

from music_api.access import AccessKind, Bindings
from music_api.config import Settings
from music_api.main import create_app
from music_api.runtime_types import InferenceRuntime


class ListenerLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Uvicorn's WS handshake logs include query strings even when HTTP
        # access_log=False. Discard them so erroneous query credentials do not
        # become durable logs; retain the route and handshake outcome.
        if isinstance(record.msg, str) and "WebSocket %s" in record.msg and isinstance(record.args, tuple) and len(record.args) >= 2:
            address, path, *remaining = record.args
            if isinstance(path, str):
                record.args = (address, path.split("?", 1)[0], *remaining)
        return True


def validate_lan_address(address: str) -> None:
    statistics = psutil.net_if_stats()
    for name, entries in psutil.net_if_addrs().items():
        if name in statistics and statistics[name].isup:
            if any(entry.family == socket.AF_INET and entry.address == address for entry in entries):
                return
    raise ValueError("Selected LAN IPv4 does not belong to an active local network interface")


@contextmanager
def bound_server(settings: Settings, runtime: InferenceRuntime | None = None) -> Iterator[tuple[uvicorn.Server, list[socket.socket]]]:
    if settings.lan_host is not None:
        validate_lan_address(settings.lan_host)
    addresses: list[tuple[str, int, AccessKind]] = [(settings.local_host, settings.local_port, "local")]
    if settings.lan_host is not None:
        addresses.append((settings.lan_host, settings.lan_port, "lan"))
    sockets: list[socket.socket] = []
    bindings: Bindings = {}
    logger, log_filter = logging.getLogger("uvicorn.error"), ListenerLogFilter()
    try:
        for host, port, kind in addresses:
            owned = socket.socket(socket.AF_INET6 if host == "::1" else socket.AF_INET, socket.SOCK_STREAM)
            sockets.append(owned)
            # Never permit another Windows process to share an apparently owned
            # listener; POSIX permits a clean restart without a wildcard bind.
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                owned.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            else:
                owned.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            owned.bind((host, port))
            actual = owned.getsockname()
            bindings[(str(actual[0]), int(actual[1]))] = kind
        app = create_app(settings, runtime=runtime, listener_bindings=bindings)
        server = uvicorn.Server(uvicorn.Config(app, proxy_headers=False, access_log=settings.lan_host is None))
        if settings.lan_host is not None:
            logger.addFilter(log_filter)
        yield server, sockets
    finally:
        logger.removeFilter(log_filter)
        for owned in sockets:
            owned.close()
