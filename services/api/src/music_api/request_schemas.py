"""Confirmed resource references do not duplicate Job or Project snapshots."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class RequestRead(BaseModel):
    request_id: UUID
    operation: Literal["create_project", "generate", "retry"]
    project_id: UUID
    resource_type: Literal["project", "job"]
    resource_id: UUID
    source_job_id: UUID | None
    created_at: datetime
