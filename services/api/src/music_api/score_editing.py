"""Save immutable ABC Assets independently of inference and Version history."""

import io
import hashlib
import logging
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from music_api.database import Asset, Database
from music_api.errors import DomainError
from music_api.job_models import Score
from music_api.schemas import ScoreCreate
from music_api.score_input import selected_score_validation
from music_api.storage import Storage, discard_owned
from music_api.version_models import Version


log = logging.getLogger("music_api")


def save_score(database: Database, session: Session, storage: Storage, project_id: UUID, value: ScoreCreate) -> tuple[Score, bool]:
    selected_score_validation(value.abc)
    source = session.get(Score, str(value.source_score_id)) if value.source_score_id else None
    if value.source_score_id and (source is None or source.project_id != str(project_id)):
        raise DomainError(404, "score_not_found", "Source Score does not exist in this Project.", "Select a Score from this Project.")
    parent_id = str(value.parent_version_id) if value.parent_version_id else source.parent_version_id if source else None
    if parent_id:
        parent = session.get(Version, parent_id)
        if parent is None or parent.project_id != str(project_id):
            raise DomainError(404, "parent_version_not_found", "Parent Version does not exist in this Project.", "Select a Version from this Project.")
        if source is None or (parent.score_id != source.id and source.parent_version_id != parent.id):
            raise DomainError(409, "source_parent_mismatch", "The source Score does not belong to this editing parent.", "Keep the edit and select its original Version.")
    score_id, asset_id = str(value.save_id), str(uuid4())
    existing = session.get(Score, score_id)
    if existing is not None:
        if existing.project_id != str(project_id) or existing.job_id is not None or existing.source_score_id != (source.id if source else None) or existing.parent_version_id != parent_id:
            raise DomainError(409, "score_save_conflict", "This save id already belongs to another immutable Score intent.", "Read the existing Score or start a new explicit save intent.", UUID(score_id))
        previous = session.get(Asset, existing.abc_asset_id)
        if previous is None or previous.project_id != str(project_id):
            raise DomainError(409, "asset_unavailable", "Saved Score content is unavailable.", "Restore the original Asset; do not overwrite it.", UUID(score_id))
        if previous.sha256 != hashlib.sha256(value.abc.encode("utf-8")).hexdigest():
            raise DomainError(409, "score_save_conflict", "This save id already retains different ABC.", "Use a new explicit save intent for different text.", UUID(score_id))
        if previous.storage_key != str(project_id) + "/" + previous.id + ".abc":
            raise DomainError(409, "asset_path_invalid", "The saved Score file mapping is invalid.", "Restore its original Asset metadata.", UUID(score_id))
        if hashlib.sha256(storage.readable(previous.storage_key, previous.size_bytes).read_bytes()).hexdigest() != previous.sha256:
            raise DomainError(409, "asset_unavailable", "Saved ABC differs from its original recorded bytes.", "Restore the original file; do not overwrite the saved Score.", UUID(score_id))
        return existing, False
    key = str(project_id) + "/" + asset_id + ".abc"
    staged = None
    published = None
    keep_published = False
    try:
        staged = storage.stage(io.BytesIO(value.abc.encode("utf-8")))
        published = storage.publish(staged, key)
        asset = Asset(id=asset_id, project_id=str(project_id), kind="score_abc", original_name="edited-score.abc",
                      storage_key=key, format="abc", media_type="text/vnd.abc", size_bytes=staged.size_bytes, sha256=staged.sha256)
        score = Score(id=score_id, project_id=str(project_id), job_id=None, abc_asset_id=asset_id,
                      source_reference_asset_id=source.source_reference_asset_id if source else None,
                      source_score_id=source.id if source else None, parent_version_id=parent_id)
        session.add(asset)
        session.flush()
        session.add(score)
        session.commit()
        keep_published = True
        return score, True
    except Exception as error:
        rollback_confirmed = True
        try:
            session.rollback()
        except Exception:
            rollback_confirmed = False
        try:
            keep_published = database.asset_persisted(asset_id) or not rollback_confirmed
        except Exception:
            keep_published = True
        if keep_published:
            raise DomainError(503, "score_commit_unconfirmed", "Score save acknowledgement is unavailable; its file is retained.",
                              "Read this Score id before saving again.", UUID(score_id)) from error
        if isinstance(error, DomainError):
            raise
        log.exception("Edited Score could not be saved", extra={"event": "score_save_failed", "score_id": score_id})
        raise DomainError(503, "score_save_failed", "Edited Score could not be saved.", "Keep the draft and retry when application storage is available.") from error
    finally:
        for path in ([staged.path] if staged else []) + ([published] if published and not keep_published else []):
            discard_owned(path)
