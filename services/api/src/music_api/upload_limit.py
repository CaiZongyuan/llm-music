"""Bound the multipart parser's input, including requests without Content-Length."""

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from music_api.schemas import ErrorDetail, ErrorResponse


MULTIPART_OVERHEAD_BYTES = 65536


class UploadBodyLimit:
    def __init__(self, app: ASGIApp, max_upload_bytes: int) -> None:
        self.app = app
        self.limit = max_upload_bytes + MULTIPART_OVERHEAD_BYTES

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] != "POST" or not scope["path"].startswith("/projects/") or not scope["path"].endswith("/assets"):
            await self.app(scope, receive, send)
            return
        headers = dict(scope["headers"])
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            declared = 0
        if declared > self.limit:
            detail = ErrorDetail(code="upload_too_large", message="Upload exceeds the configured request byte budget.",
                                recovery="Send one smaller file with minimal multipart fields.")
            await JSONResponse(ErrorResponse(error=detail).model_dump(mode="json"), status_code=413)(scope, receive, send)
            return
        observed = 0

        async def limited_receive() -> Message:
            nonlocal observed
            message = await receive()
            observed += len(message.get("body", b""))
            if observed > self.limit:
                # The pinned multipart parser closes temporary files on any stream exception.
                raise HTTPException(413, "Upload exceeds the configured request byte budget.")
            return message

        await self.app(scope, limited_receive, send)
