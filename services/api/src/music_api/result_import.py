"""Validated result sets have one coordinated metadata/completion transaction."""

from dataclasses import dataclass
from typing import Callable, Mapping
import io
import logging
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

from sqlalchemy.orm import Session

from music_api.audio import AudioFacts
from music_api.database import Asset, Database, utc_now
from music_api.errors import DomainError
from music_api.job_models import Job, JobResult, Score
from music_api.runtime_types import ArtifactFormat, ArtifactRole, RuntimeResult
from music_api.storage import Storage, discard_owned, original_name


@dataclass(frozen=True)
class ImportMaterial:
    role: ArtifactRole
    data: bytes
    format: ArtifactFormat
    media_type: str
    name: str
    audio_facts: AudioFacts | None = None


@dataclass(frozen=True)
class ImportedBundle:
    assets: Mapping[ArtifactRole, Asset]
    score: Score


ResultRegistrar = Callable[[Session, Job, ImportedBundle], Mapping[str, str]]


log = logging.getLogger("music_api")


def import_result(database: Database, storage: Storage, job_id: str, materials: tuple[ImportMaterial, ...],
                  result: RuntimeResult, registrar: ResultRegistrar | None) -> None:
    published: list[Path] = []
    staged: list[Path] = []
    owned_ids: list[str] = []
    keep_published = False
    commit_attempted = False
    with database.sessions() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise DomainError(404, "job_not_found", "Job does not exist.", "Query its Project.")
        if job.status in {"completed", "failed", "cancelled"}:
            return
        assets: dict[ArtifactRole, Asset] = {}
        try:
            for material in materials:
                identifier = str(uuid4())
                owned_ids.append(identifier)
                key = job.project_id + "/" + identifier + "." + material.format
                stage = storage.stage(io.BytesIO(material.data))
                staged.append(stage.path)
                published.append(storage.publish(stage, key))
                facts = material.audio_facts
                asset = Asset(id=identifier, project_id=job.project_id,
                              kind={"abc": "score_abc", "midi": "score_midi", "audio": "generated_audio"}[material.role],
                              original_name=original_name(material.name), storage_key=key, format=material.format,
                              media_type=material.media_type, size_bytes=stage.size_bytes, sha256=stage.sha256,
                              duration_seconds=facts.duration_seconds if facts else None, channels=facts.channels if facts else None,
                              sample_rate=facts.sample_rate if facts else None, sample_width_bits=facts.sample_width_bits if facts else None)
                session.add(asset)
                assets[material.role] = asset
            session.flush()
            score = Score(id=str(uuid4()), project_id=job.project_id, job_id=job.id, abc_asset_id=assets["abc"].id,
                          source_reference_asset_id=str(job.inputs["reference_asset_id"]) if job.operation == "Transcribe" else None)
            session.add(score)
            for role, asset in assets.items():
                session.add(JobResult(id=str(uuid4()), job_id=job.id, asset_id=asset.id, role=role))
            session.flush()
            refs: dict[str, str] = dict(score_id=score.id)
            refs.update({role + "_asset_id": asset.id for role, asset in assets.items()})
            job.provenance = dict(job.provenance, result_validation=dict(result.score_validation or {}), **dict(result.provenance))
            if registrar is not None:
                refs.update(registrar(session, job, ImportedBundle(assets, score)))
            job.result_refs = refs
            job.error = None
            job.status, job.phase, job.progress = "completed", None, None
            job.updated_at = utc_now()
            commit_attempted = True
            session.commit()
            keep_published = True
        except Exception as error:
            rollback_confirmed = True
            try:
                session.rollback()
            except Exception:
                rollback_confirmed = False
            try:
                with database.engine.connect() as connection:
                    durable = connection.execute(select(Asset.id).where(Asset.id.in_(owned_ids))).first() is not None
                    completed = connection.execute(select(Job.status).where(Job.id == job_id)).scalar_one_or_none() == "completed"
                keep_published = durable or completed or not rollback_confirmed
                if completed:
                    return
            except Exception:
                keep_published = True
            if keep_published:
                raise DomainError(503, "result_commit_unconfirmed", "Result persistence outcome is unconfirmed; its files are retained.", "Query the same Job before explicitly retrying; do not resubmit inference automatically.") from error
            if isinstance(error, OSError):
                raise DomainError(503, "result_storage_unavailable", "Validated output could not be imported into application storage.", "Restore storage access and query this Job before explicitly retrying.") from error
            if isinstance(error, DomainError):
                raise
            raise DomainError(503, "result_persistence_failed", "Validated result metadata could not be committed." if commit_attempted else "Validated result metadata could not be associated.", "Restore database access and retain this Job's input/attempt evidence.") from error
        finally:
            cleanup_errors = []
            for path in staged + ([] if keep_published else published):
                try:
                    discard_owned(path)
                except DomainError as error:
                    cleanup_errors.append(error)
                    log.exception("Owned result cleanup failed", extra={"event": "result_cleanup_failed", "job_id": job_id})
            if cleanup_errors:
                raise cleanup_errors[-1]
