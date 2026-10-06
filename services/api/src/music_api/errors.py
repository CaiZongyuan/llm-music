"""Public domain failures keep filesystem and database details in logs."""

from uuid import UUID
import logging

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

from music_api.schemas import ErrorDetail, ErrorResponse


log = logging.getLogger("music_api")


class DomainError(Exception):
    def __init__(self, status: int, code: str, message: str, recovery: str, resource_id: UUID | None = None) -> None:
        self.status = status
        self.detail = ErrorDetail(code=code, message=message, recovery=recovery, resource_id=resource_id)
        super().__init__(message)


async def domain_error_response(request: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, DomainError):
        raise error
    return JSONResponse(status_code=error.status, content=ErrorResponse(error=error.detail).model_dump(mode="json"))


async def validation_error_response(request: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, RequestValidationError):
        raise error
    problem = error.errors()[0]
    parameter = ".".join(str(part) for part in problem["loc"][1:]) or "request"
    detail = ErrorDetail(code="invalid_request", message=parameter + ": " + problem["msg"],
                        recovery="Check this parameter against the documented API schema.")
    return JSONResponse(status_code=422, content=ErrorResponse(error=detail).model_dump(mode="json"))


async def http_error_response(request: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, HTTPException):
        raise error
    detail = ErrorDetail(code="upload_too_large" if error.status_code == 413 else "invalid_request",
                        message=str(error.detail), recovery="Check the route, method and documented request fields.")
    return JSONResponse(status_code=error.status_code, headers=error.headers, content=ErrorResponse(error=detail).model_dump(mode="json"))


async def dependency_error_response(request: Request, error: Exception) -> JSONResponse:
    log.error("Application persistence unavailable", exc_info=error,
              extra={"event": "application_persistence_failed", "request_path": request.url.path})
    code = "metadata_unavailable" if isinstance(error, SQLAlchemyError) else "asset_storage_unavailable"
    detail = ErrorDetail(code=code, message="Application metadata or file storage is unavailable.",
                        recovery="Ask the owner to restore access to the configured application data directory.")
    return JSONResponse(status_code=503, content=ErrorResponse(error=detail).model_dump(mode="json"))
