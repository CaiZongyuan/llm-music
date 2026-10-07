"""Explicit Version save serializes on SQLite without mutating an earlier snapshot."""

import logging
from uuid import UUID, uuid4

from sqlalchemy import exists, literal, select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from music_api.database import Asset, Database, utc_now
from music_api.errors import DomainError
from music_api.generation_schemas import VersionSave
from music_api.main import asset_file, project_in
from music_api.storage import Storage
from music_api.version_models import Candidate, Version


log = logging.getLogger("music_api")


def candidate_in(session: Session, project_id: UUID, candidate_id: UUID) -> Candidate:
    project_in(session, project_id)
    result = session.scalar(select(Candidate).where(Candidate.id == str(candidate_id), Candidate.project_id == str(project_id)))
    if result is None:
        raise DomainError(404, "candidate_not_found", "Candidate does not exist in this Project.",
                          "Select a completed Candidate belonging to this Project.")
    return result


def version_in(session: Session, project_id: UUID, version_id: UUID) -> Version:
    project_in(session, project_id)
    result = session.scalar(select(Version).where(Version.id == str(version_id), Version.project_id == str(project_id)))
    if result is None:
        raise DomainError(404, "version_not_found", "Version does not exist in this Project.", "Select a Version in this Project.")
    return result


def readable_outputs(session: Session, storage: Storage, result: Candidate | Version) -> None:
    score = result.output_snapshot.get("score")
    abc_id = score.get("abc_asset_id") if isinstance(score, dict) else None
    if not isinstance(abc_id, str):
        raise DomainError(409, "candidate_result_invalid", "Saved Score reference is unavailable.", "Restore the original Candidate result metadata.")
    for identifier in [result.audio_asset_id, abc_id]:
        asset = session.get(Asset, identifier)
        if asset is None or asset.project_id != result.project_id:
            raise DomainError(409, "candidate_result_invalid", "Result Asset does not belong to this Project.", "Restore the original result metadata.")
        asset_file(storage, asset)


def save_version(database: Database, session: Session, storage: Storage, project_id: UUID,
                 value: VersionSave) -> tuple[Version, bool]:
    identifier = uuid4()
    parent = str(value.parent_version_id) if value.parent_version_id else None
    parent_allowed = literal(True) if parent is None else exists(select(Version.id).where(Version.id == parent, Version.project_id == str(project_id)))
    # First statement acquires the writer slot before any read snapshot. Concurrent
    # identical saves wait, then resolve through the durable unique candidate key.
    statement = insert(Version).from_select(
        ["id", "project_id", "candidate_id", "job_id", "name", "parent_version_id", "audio_asset_id", "score_id",
         "inputs", "provenance", "output_snapshot", "created_at"],
        select(literal(str(identifier)), Candidate.project_id, Candidate.id, Candidate.job_id, literal(value.name), literal(parent),
               Candidate.audio_asset_id, Candidate.score_id, Candidate.inputs, Candidate.provenance, Candidate.output_snapshot, literal(utc_now()))
        .where(Candidate.id == str(value.candidate_id), Candidate.project_id == str(project_id), parent_allowed)
    ).on_conflict_do_nothing(index_elements=["candidate_id"]).returning(Version.id)
    try:
        inserted = session.execute(statement).scalar_one_or_none()
        version = session.scalar(select(Version).where(Version.candidate_id == str(value.candidate_id), Version.project_id == str(project_id)))
        if version is None:
            candidate_in(session, project_id, value.candidate_id)
            raise DomainError(404, "parent_version_not_found", "Parent Version does not exist in this Project.", "Choose a parent from this Project or omit it.")
        if version.name != value.name or version.parent_version_id != parent:
            raise DomainError(409, "version_already_saved", "Candidate was already saved with a different name or parent.",
                              "Read the existing Version; generate another Candidate for a new saved intent.", UUID(version.id))
        readable_outputs(session, storage, version)
        session.commit()
        return version, inserted is not None
    except DomainError:
        session.rollback()
        raise
    except Exception as error:
        log.exception("Version commit acknowledgement failed", extra={"event": "version_commit_failed", "version_id": str(identifier)})
        try:
            session.rollback()
        except Exception:
            log.exception("Version rollback acknowledgement failed", extra={"event": "version_rollback_unknown", "version_id": str(identifier)})
        recovered_id = None
        try:
            with database.sessions() as check:
                recovered = check.scalar(select(Version).where(Version.candidate_id == str(value.candidate_id), Version.project_id == str(project_id)))
                if recovered is not None:
                    recovered_id = recovered.id
        except Exception:
            log.exception("Version readback unavailable", extra={"event": "version_commit_unknown", "version_id": str(identifier)})
        resource_id = UUID(recovered_id) if recovered_id is not None else identifier
        raise DomainError(503, "version_commit_unconfirmed", "Version save could not be confirmed.",
                          "Query this Version id before retrying the identical save; existing Assets and snapshots were retained.", resource_id) from error
