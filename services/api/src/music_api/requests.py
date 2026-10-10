"""Match durable intent before dynamic checks; commit beside its resource."""

from dataclasses import dataclass
from datetime import datetime
import hashlib
import json
from typing import Literal
from uuid import UUID

from fastapi import Request
from sqlalchemy import update
from sqlalchemy.orm import Session

from music_api.errors import DomainError
from music_api.pairing_models import ServerIdentity
from music_api.request_models import ClientRequest
from music_api.request_schemas import RequestRead


@dataclass(frozen=True)
class RequestIntent:
    request_id: UUID
    operation: Literal["create_project", "generate", "retry"]
    inputs: dict[str, object]
    project_id: UUID | None = None
    source_job_id: UUID | None = None

    @property
    def digest(self) -> str:
        value = dict(operation=self.operation, project_id=str(self.project_id) if self.project_id else None,
                     source_job_id=str(self.source_job_id) if self.source_job_id else None, inputs=self.inputs)
        return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()


def require_request_key(request: Request, key: UUID | None) -> UUID | None:
    if request.state.access_kind == "lan" and key is None:
        raise DomainError(422, "idempotency_key_required", "Idempotency-Key is required for this LAN write.",
                          "Persist a UUID key and frozen intent before submitting; retain the same key after an uncertain response.")
    return key


def reserve_request_writer(session: Session) -> None:
    session.execute(update(ServerIdentity).where(ServerIdentity.singleton == 1).values(singleton=1))


def matching_request(session: Session, intent: RequestIntent) -> ClientRequest | None:
    previous = session.get(ClientRequest, str(intent.request_id))
    if previous is not None and previous.input_digest != intent.digest:
        raise DomainError(409, "idempotency_conflict", "This request key was already committed for another intent.",
                          "Read the original request and resource; do not change a frozen intent under the same key.", intent.request_id)
    return previous


def record_request(session: Session, intent: RequestIntent, project_id: str, job_id: str | None = None) -> None:
    session.add(ClientRequest(request_id=str(intent.request_id), operation=intent.operation,
                              target_project_id=str(intent.project_id) if intent.project_id else None,
                              source_job_id=str(intent.source_job_id) if intent.source_job_id else None,
                              input_digest=intent.digest, project_id=project_id, job_id=job_id))


def request_read(value: ClientRequest) -> RequestRead:
    return RequestRead(request_id=UUID(value.request_id), operation=value.operation, project_id=UUID(value.project_id),
                       resource_type="project" if value.job_id is None else "job",
                       resource_id=UUID(value.job_id or value.project_id),
                       source_job_id=UUID(value.source_job_id) if value.source_job_id else None,
                       created_at=datetime.fromisoformat(value.created_at))
