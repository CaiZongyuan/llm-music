"""Freeze an inspected Cover input while reusing the shared generation engine."""

import hashlib
from typing import Literal, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import Field
from sqlalchemy.orm import Session

from music_api.database import Asset
from music_api.errors import DomainError
from music_api.generation_schemas import CoverCreate
from music_api.job_models import Job, Score
from music_api.jobs import JobService, job_read
from music_api.main import asset_file, asset_in, project_in, session_for
from music_api.reference_audio import ReferenceOriginRead, reference_origin
from music_api.schemas import ErrorResponse, JobRead, ScoreValidate, ScoreValidationRead
from music_api.score_input import selected_score_validation
from music_api.storage import Storage
from music_api.vendor.yue2_music.abc_tools import parse_abc, strip_chords


class CoverInputValidate(ScoreValidate):
    mode: Literal["melody", "full"]


class CoverValidationRead(ScoreValidationRead):
    effective_abc: str
    mode: Literal["melody", "full"]
    mode_transform_version: str
    source_chord_count: int = Field(ge=0)
    warnings: list[str] = Field(default_factory=list, description="full_without_written_chords means full is legal but has no explicit harmony guidance.")


def cover_score_validation(abc: str, mode: str) -> dict[str, object]:
    if mode not in {"melody", "full"}:
        raise DomainError(422, "cover_mode_unsupported", "This Cover mode is unsupported.", "Keep the Score; explicitly choose melody or full when available.")
    original = selected_score_validation(abc)
    adapted = str(original["effective_abc"])
    source = parse_abc(adapted)
    chord_count = sum(len(voice.chords) for voice in source.voices.values())
    effective = strip_chords(adapted, keep_voice="both") if mode == "melody" else adapted
    return {**original, "effective_abc": effective, "effective_abc_sha256": hashlib.sha256(effective.encode("utf-8")).hexdigest(),
            "transformations": list(cast(list[str], original["transformations"])) + (["remove_music_chords_keep_both_voices"] if mode == "melody" and chord_count else []),
            "mode": mode, "mode_transform_version": "1.0.0", "source_chord_count": chord_count,
            "warnings": ["full_without_written_chords"] if mode == "full" and not chord_count else []}


def cover_snapshot(session: Session, storage: Storage, project_id: UUID, inputs: dict[str, object]) -> dict[str, object]:
    value = CoverCreate.model_validate(inputs)
    reference = asset_in(session, project_id, value.reference_asset_id)
    if reference.kind != "reference_audio":
        raise DomainError(422, "reference_audio_required", "Cover requires an actual Reference Audio.", "Transcribe an uploaded or Version-derived Reference first.")
    reference_bytes = asset_file(storage, reference).read_bytes()
    if hashlib.sha256(reference_bytes).hexdigest() != reference.sha256:
        raise DomainError(409, "asset_unavailable", "Reference bytes differ from their recorded hash.", "Restore the original Reference file.")
    origin = reference_origin(session, reference)
    parent = origin.source_version_id if origin else None
    if (str(value.parent_version_id) if value.parent_version_id else None) != parent:
        raise DomainError(409, "source_parent_mismatch", "Cover parent differs from the actual Reference Version source.", "Use the Reference's retained source parent; uploaded References have no parent.")
    selected = session.get(Score, str(value.source_score_id))
    if selected is None or selected.project_id != str(project_id):
        raise DomainError(404, "score_not_found", "Selected Score does not exist in this Project.", "Select a saved Score from this Project.")
    chain: list[dict[str, object]] = []
    current: Score | None = selected
    seen: set[str] = set()
    transcribed: Job | None = None
    while current is not None:
        if current.id in seen or current.project_id != str(project_id) or current.source_reference_asset_id != reference.id or current.parent_version_id != parent:
            raise DomainError(409, "cover_source_mismatch", "Selected Score lineage does not match this Reference and parent.", "Keep the Score; transcribe this Reference and explicitly select its saved edit.")
        seen.add(current.id)
        asset = session.get(Asset, current.abc_asset_id)
        if asset is None or asset.project_id != str(project_id):
            raise DomainError(409, "cover_source_mismatch", "Source Score file does not belong to this Project.", "Restore the original Score Asset.")
        data = asset_file(storage, asset).read_bytes()
        if hashlib.sha256(data).hexdigest() != asset.sha256 or current.id == selected.id and data != value.abc.encode("utf-8"):
            raise DomainError(409, "cover_selection_mismatch", "Selected ABC does not match its immutable saved Score.", "Save the inspected edit as a Score and select it again.")
        chain.append(dict(score_id=current.id, abc_asset_id=asset.id, abc_sha256=asset.sha256, source_score_id=current.source_score_id))
        if current.source_score_id is not None:
            current = session.get(Score, current.source_score_id)
            if current is None:
                raise DomainError(409, "cover_source_mismatch", "The original transcription source is unavailable.", "Restore the saved Score lineage.")
            continue
        transcribed = session.get(Job, current.job_id) if current.job_id else None
        if (transcribed is None or transcribed.project_id != str(project_id) or transcribed.operation != "Transcribe" or transcribed.status != "completed"
                or transcribed.inputs.get("reference_asset_id") != reference.id or transcribed.inputs.get("reference_sha256") != reference.sha256
                or (transcribed.result_refs or {}).get("score_id") != current.id):
            raise DomainError(409, "cover_source_mismatch", "Cover requires a completed transcription of this exact Reference.", "Transcribe the Reference, inspect and explicitly select its Score.")
        break
    validation = cover_score_validation(value.abc, value.mode)
    if validation["effective_abc_sha256"] != value.effective_abc_sha256 or validation["mode_transform_version"] != value.mode_transform_version:
        raise DomainError(409, "cover_selection_mismatch", "The selected effective ABC or transform revision differs from the current input.", "Inspect the effective ABC and explicitly select it again.")
    assert transcribed is not None
    return dict(selected_score=dict(source_score_id=selected.id, parent_version_id=parent, **validation),
                cover_source=dict(reference_asset_id=reference.id, reference_sha256=reference.sha256,
                                  reference_origin=ReferenceOriginRead.model_validate(origin).model_dump(mode="json") if origin else None,
                                  transcribe_job_id=transcribed.id, transcribed_score_id=chain[-1]["score_id"], score_chain=chain))


router = APIRouter(responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})


@router.post("/projects/{project_id}/cover-inputs/validate", response_model=CoverValidationRead)
def validate_cover(project_id: UUID, value: CoverInputValidate, session: Session = Depends(session_for)) -> CoverValidationRead:
    project_in(session, project_id)
    return CoverValidationRead.model_validate(cover_score_validation(value.abc, value.mode))


@router.post("/projects/{project_id}/jobs/cover", response_model=JobRead, status_code=202)
def create_cover(project_id: UUID, value: CoverCreate, request: Request, session: Session = Depends(session_for)) -> JobRead:
    project_in(session, project_id)
    jobs: JobService = request.app.state.jobs
    return job_read(jobs.submit(project_id, "Cover", value.model_dump(mode="json")))
