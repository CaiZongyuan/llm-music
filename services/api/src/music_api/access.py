"""Direct local/LAN access is selected by the actual accepting socket."""

import hmac
from typing import Literal

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

from music_api.config import Settings
from music_api.errors import DomainError, dependency_error_response
from music_api.pairing import PairingService
from music_api.schemas import ErrorResponse


AccessKind = Literal["local", "lan"]
Bindings = dict[tuple[str, int], AccessKind]


class AccessPolicy:
    def __init__(self, settings: Settings, bindings: Bindings | None) -> None:
        self.settings = settings
        local_host = "[::1]" if settings.local_host == "::1" else settings.local_host
        self.owner_origins = {*settings.owner_origins, f"http://{local_host}:{settings.local_port}"}
        if settings.local_host == "127.0.0.1":
            self.owner_origins.add(f"http://localhost:{settings.local_port}")
        # Legacy direct ASGI fixtures have no physical listener. LAN never uses
        # that compatibility path; serving entrypoints always pass real bindings.
        self.bindings: Bindings | None = bindings if bindings is not None else (
            {(settings.local_host, settings.local_port): "local", (settings.lan_host, settings.lan_port): "lan"}
            if settings.lan_host is not None else None)

    def kind(self, scope: Scope) -> AccessKind:
        if self.bindings is None:
            return "local"
        address = scope.get("server")
        kind = self.bindings.get(tuple(address)) if address is not None else None
        if kind is None:
            raise DomainError(403, "listener_forbidden", "This listener is not configured.", "Use the configured computer or LAN address.")
        return kind

class DeviceAccess:
    def __init__(self, app: ASGIApp, policy: AccessPolicy) -> None:
        self.app, self.policy = app, policy

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in {"http", "websocket"}:
            await self.app(scope, receive, send)
            return
        headers = Headers(scope=scope)
        try:
            kind = self.policy.kind(scope)
            scope.setdefault("state", {})["access_kind"] = kind
            pairing: PairingService = scope["app"].state.pairing
            owner_route = scope["path"].startswith("/pairing/") and scope["path"] != "/pairing/claim"
            if owner_route:
                if kind != "local":
                    raise DomainError(403, "owner_local_only", "Pairing administration is available only on the local listener.", "Open the computer's local workbench.")
                origin = headers.get("origin")
                if origin is not None and origin not in self.policy.owner_origins:
                    raise DomainError(403, "owner_origin_forbidden", "This browser Origin cannot administer pairing.", "Open the computer's configured local workbench.")
                if scope.get("method") not in {"GET", "HEAD"} and not hmac.compare_digest(
                        headers.get("x-owner-csrf", "").encode("utf-8"), pairing.owner_csrf.encode("ascii")):
                    raise DomainError(403, "owner_csrf_required", "A current owner CSRF token is required.", "Read the local owner session and retry from the computer.")
            await self.app(scope, receive, send)
        except DomainError as error:
            if scope["type"] == "websocket":
                await send({"type": "websocket.close", "code": 4401 if error.status == 401 else 4403})
            else:
                await JSONResponse(status_code=error.status, content=ErrorResponse(error=error.detail).model_dump(mode="json"))(scope, receive, send)
        except SQLAlchemyError as error:
            if scope["type"] == "websocket":
                await send({"type": "websocket.close", "code": 1011, "reason": "Application data is unavailable."})
            else:
                response = await dependency_error_response(Request(scope), error)
                await response(scope, receive, send)
