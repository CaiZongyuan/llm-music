"""Candidate is an imported result; only explicit save creates a Version."""

from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from music_api.database import Base, utc_now


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"), index=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="RESTRICT"), unique=True)
    audio_asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id", ondelete="RESTRICT"))
    score_id: Mapped[str] = mapped_column(ForeignKey("scores.id", ondelete="RESTRICT"))
    inputs: Mapped[dict[str, object]] = mapped_column(JSON)
    provenance: Mapped[dict[str, object]] = mapped_column(JSON)
    output_snapshot: Mapped[dict[str, object]] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)


class Version(Base):
    __tablename__ = "versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"), index=True)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id", ondelete="RESTRICT"), unique=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="RESTRICT"))
    name: Mapped[str] = mapped_column(String(200))
    parent_version_id: Mapped[str | None] = mapped_column(ForeignKey("versions.id", ondelete="RESTRICT"), nullable=True)
    audio_asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id", ondelete="RESTRICT"))
    score_id: Mapped[str] = mapped_column(ForeignKey("scores.id", ondelete="RESTRICT"))
    inputs: Mapped[dict[str, object]] = mapped_column(JSON)
    provenance: Mapped[dict[str, object]] = mapped_column(JSON)
    output_snapshot: Mapped[dict[str, object]] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)
