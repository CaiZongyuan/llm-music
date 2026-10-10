"""Generate consumes one shared Job/import boundary and registers an unsaved Candidate."""

from copy import deepcopy
from typing import Mapping, cast
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from music_api.database import Asset
from music_api.errors import DomainError
from music_api.generation_audio import validate_flac
from music_api.generation_schemas import GenerateCreate, GenerateFromScoreCreate
from music_api.job_models import Job, Score
from music_api.jobs import JobService, job_read, validate_score
from music_api.main import project_in, session_for
from music_api.result_import import ImportedBundle, ImportMaterial
from music_api.runtime_types import RuntimeResult
from music_api.schemas import ErrorResponse, JobRead
from music_api.version_models import Candidate, Version
from music_api.score_input import selected_score_validation


def validate_generation(result: RuntimeResult, inputs: Mapping[str, object]) -> tuple[ImportMaterial, ...]:
    abc = validate_score(result)
    audio_outputs = [artifact for artifact in result.artifacts if artifact.role == "audio"]
    if len(audio_outputs) != 1:
        raise DomainError(503, "generation_failed", "Required generated Audio is missing or duplicated.",
                          "Retain this Job and inspect the Runtime result; do not save an incomplete Candidate.")
    audio = audio_outputs[0]
    if audio.format != "flac":
        raise DomainError(503, "generation_failed", "Audio format differs from the pinned FLAC generation output.",
                          "Verify the selected generation workflow and keep its original output.")
    facts = validate_flac(audio.data, int(cast(int, inputs.get("max_seconds", 0))))
    return (ImportMaterial("abc", abc.data, "abc", "text/vnd.abc", "score.abc"),
            ImportMaterial("audio", audio.data, "flac", "audio/flac", "generated.flac", facts))


def audio_snapshot(asset: Asset) -> dict[str, object]:
    return dict(asset_id=asset.id, format=asset.format, media_type=asset.media_type, size_bytes=asset.size_bytes,
                sha256=asset.sha256, duration_seconds=asset.duration_seconds, sample_rate=asset.sample_rate,
                channels=asset.channels, sample_width_bits=asset.sample_width_bits)


def register_candidate(session: Session, job: Job, result: ImportedBundle) -> Mapping[str, str]:
    audio, abc = result.assets["audio"], result.assets["abc"]
    if job.operation not in {"Generate", "GenerateFromScore", "Cover"} or audio.project_id != job.project_id or abc.project_id != job.project_id or result.score.project_id != job.project_id:
        raise DomainError(409, "candidate_result_invalid", "Generation output ownership differs from its Job.",
                          "Retain the result evidence and restore the same-Project Job mapping.")
    if job.operation in {"GenerateFromScore", "Cover"}:
        selected = job.provenance.get("selected_score")
        expected_hash = selected.get("effective_abc_sha256") if isinstance(selected, dict) else None
        if abc.sha256 != expected_hash:
            raise DomainError(503, "score_result_mismatch", "Generated Score differs from the selected inference input.",
                              "Retain the Job evidence and inspect the Runtime mapping; no Candidate was saved.")
    if job.operation == "Cover":
        result.score.source_reference_asset_id = str(job.inputs["reference_asset_id"])
        result.score.source_score_id = str(job.inputs["source_score_id"])
        parent = job.inputs.get("parent_version_id")
        result.score.parent_version_id = str(parent) if parent is not None else None
    candidate = Candidate(id=str(uuid4()), project_id=job.project_id, job_id=job.id,
                          audio_asset_id=audio.id, score_id=result.score.id, inputs=deepcopy(job.inputs),
                          provenance=deepcopy(job.provenance),
                          output_snapshot=dict(audio=audio_snapshot(audio), score=dict(score_id=result.score.id, abc_asset_id=abc.id,
                                                                                     sha256=abc.sha256, size_bytes=abc.size_bytes)))
    session.add(candidate)
    return dict(candidate_id=candidate.id)


def configure_generation(jobs: JobService) -> None:
    jobs.register_result("Generate", register_candidate, validate_generation)
    jobs.register_result("GenerateFromScore", register_candidate, validate_generation)
    jobs.register_result("Cover", register_candidate, validate_generation)


router = APIRouter(responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})


@router.post("/projects/{project_id}/jobs/generate", response_model=JobRead, status_code=202)
def create_generate_job(project_id: UUID, value: GenerateCreate, request: Request,
                        session: Session = Depends(session_for)) -> JobRead:
    project_in(session, project_id)
    jobs: JobService = request.app.state.jobs
    return job_read(jobs.submit(project_id, "Generate", value.model_dump()))


@router.post("/projects/{project_id}/jobs/generate-from-score", response_model=JobRead, status_code=202,
             responses={409: {"model": ErrorResponse}})
def create_generate_from_score_job(project_id: UUID, value: GenerateFromScoreCreate, request: Request,
                                  session: Session = Depends(session_for)) -> JobRead:
    project_in(session, project_id)
    source = session.get(Score, str(value.source_score_id))
    if source is None or source.project_id != str(project_id):
        raise DomainError(404, "score_not_found", "Source Score does not exist in this Project.", "Select an existing Score from this Project.")
    if value.parent_version_id is not None:
        parent = session.get(Version, str(value.parent_version_id))
        if parent is None or parent.project_id != str(project_id):
            raise DomainError(404, "parent_version_not_found", "Parent Version does not exist in this Project.", "Select the source Version in this Project or omit the parent.")
        if parent.score_id != source.id and source.parent_version_id != parent.id:
            raise DomainError(409, "source_parent_mismatch", "The parent Version does not own the selected source Score.", "Select the Score belonging to this parent Version.")
    selected_score_validation(value.abc)
    jobs: JobService = request.app.state.jobs
    return job_read(jobs.submit(project_id, "GenerateFromScore", value.model_dump(mode="json")))
