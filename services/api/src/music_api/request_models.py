"""A committed client request identifies a single business resource."""

from typing import Literal

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from music_api.database import Base, utc_now


class ClientRequest(Base):
    __tablename__ = "client_requests"

    request_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    operation: Mapped[Literal["create_project", "generate", "retry"]] = mapped_column(String(16))
    target_project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"))
    source_job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id", ondelete="RESTRICT"))
    input_digest: Mapped[str] = mapped_column(String(64))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"))
    job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id", ondelete="RESTRICT"))
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)
