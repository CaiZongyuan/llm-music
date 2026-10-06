"""File import and metadata commit retain ownership through uncertain outcomes."""

import logging
from pathlib import Path
from typing import BinaryIO
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from music_api.audio import inspect_wav
from music_api.database import Asset, Database
from music_api.errors import DomainError
from music_api.storage import Storage, discard_owned, original_name


log = logging.getLogger("music_api")


def import_audio(database: Database, session: Session, storage: Storage, project_id: UUID,
                 name: str | None, source: BinaryIO) -> Asset:
    name = original_name(name)
    identifier = uuid4()
    key = str(project_id) + "/" + str(identifier) + ".wav"
    staged = None
    published = None
    keep_published = False
    try:
        staged = storage.stage(source)
        facts = inspect_wav(staged.path, database.settings.max_audio_seconds)
        published = storage.publish(staged, key)
        asset = Asset(id=str(identifier), project_id=str(project_id), kind="reference_audio", original_name=name,
                      storage_key=key, format="wav", media_type="audio/wav", size_bytes=staged.size_bytes,
                      sha256=staged.sha256, duration_seconds=facts.duration_seconds, channels=facts.channels,
                      sample_rate=facts.sample_rate, sample_width_bits=facts.sample_width_bits)
        try:
            session.add(asset)
            session.commit()
        except Exception as error:
            log.exception("Asset commit acknowledgement failed", extra={"event": "asset_commit_failed", "asset_id": str(identifier)})
            rollback_confirmed = True
            try:
                session.rollback()
            except Exception:
                rollback_confirmed = False
                log.exception("Asset rollback failed", extra={"event": "asset_rollback_failed", "asset_id": str(identifier)})
            # Commit may already be durable. An independent read controls safe file compensation.
            try:
                persisted = database.asset_persisted(str(identifier))
                keep_published = persisted or not rollback_confirmed
            except Exception:
                keep_published = True
                log.exception("Asset commit readback unavailable", extra={"event": "asset_commit_unknown", "asset_id": str(identifier)})
            if keep_published:
                raise DomainError(503, "asset_commit_unconfirmed", "Upload acknowledgement failed; its file was retained for recovery.",
                                  "Query this Project's Asset id before retrying the upload.", identifier) from error
            raise DomainError(503, "asset_persistence_failed", "Audio metadata could not be saved; this upload was rolled back.",
                              "Ask the owner to restore the database, then explicitly retry the upload.") from error
        keep_published = True
        return asset
    except OSError as error:
        log.exception("Asset file write failed", extra={"event": "asset_write_failed", "asset_id": str(identifier)})
        raise DomainError(503, "asset_write_failed", "Audio could not be written to application storage.",
                          "Ask the owner to check storage availability and free space, then retry.") from error
    finally:
        cleanup_paths: list[Path] = []
        if staged is not None:
            cleanup_paths.append(staged.path)
        if published is not None and not keep_published:
            cleanup_paths.append(published)
        failure = None
        for path in cleanup_paths:
            try:
                discard_owned(path)
            except DomainError as error:
                failure = error
        if failure is not None:
            failure.detail.resource_id = identifier
            raise failure
