"""Application Job/Score/result identities are independent of native requests."""

from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from music_api.database import Base, utc_now


class Namespace(Base):
    __tablename__ = "application_namespace"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    runtime_mode: Mapped[str] = mapped_column(String(16))


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint("status IN ('queued','running','completed','failed','cancelled')"),
        CheckConstraint("operation IN ('Transcribe','Generate')"),
        CheckConstraint("progress IS NULL OR (progress >= 0 AND progress <= 1)"),
        CheckConstraint("status != 'completed' OR result_refs IS NOT NULL"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"), index=True)
    operation: Mapped[str] = mapped_column(String(32))
    inputs: Mapped[dict[str, object]] = mapped_column(JSON)
    provenance: Mapped[dict[str, object]] = mapped_column(JSON)
    runtime_mode: Mapped[str] = mapped_column(String(16))
    attempt_id: Mapped[str] = mapped_column(String(36), unique=True)
    runtime_handle: Mapped[str | None] = mapped_column(String(200))
    submission_state: Mapped[str] = mapped_column(String(32), default="pending")
    status: Mapped[str] = mapped_column(String(16), default="queued")
    phase: Mapped[str | None] = mapped_column(String(32))
    progress: Mapped[float | None] = mapped_column(Float)
    error: Mapped[dict[str, object] | None] = mapped_column(JSON(none_as_null=True))
    result_refs: Mapped[dict[str, str] | None] = mapped_column(JSON(none_as_null=True))
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)
    updated_at: Mapped[str] = mapped_column(String(40), default=utc_now)


class Score(Base):
    __tablename__ = "scores"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"), index=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="RESTRICT"), unique=True)
    abc_asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id", ondelete="RESTRICT"))
    source_reference_asset_id: Mapped[str | None] = mapped_column(ForeignKey("assets.id", ondelete="RESTRICT"))
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)


class JobResult(Base):
    __tablename__ = "job_results"
    __table_args__ = (UniqueConstraint("job_id", "role"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="RESTRICT"), index=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id", ondelete="RESTRICT"))
    role: Mapped[str] = mapped_column(String(16))
