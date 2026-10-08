"""Public local HTTP application; no GPU/Runtime imports or startup dependency."""

from collections.abc import AsyncIterator, Iterator
from typing import Callable
from contextlib import asynccontextmanager
import logging
from pathlib import Path
import hashlib
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from music_api.config import Settings
from music_api.contracts import MusicAPI
from music_api.diagnostics_routes import router as diagnostics_router
from music_api.comfy_runtime import ComfyUIRuntime
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.assets import import_audio
from music_api.database import Asset, Database, Project
from music_api.errors import (DomainError, dependency_error_response, domain_error_response,
                              http_error_response, validation_error_response)
from music_api.schemas import AssetRead, ErrorResponse, JobRead, ProjectCreate, ProjectRead, ScoreCreate, ScoreRead, ScoreValidate, ScoreValidationRead, TranscribeCreate
from music_api.score_editing import save_score
from music_api.score_input import selected_score_validation
from music_api.audio import inspect_wav
from music_api.job_models import Job, Score
from music_api.jobs import JobService, job_read
from music_api.job_events import JobEventBroker
from music_api.event_routes import router as event_router
from music_api.storage import Storage
from music_api.upload_limit import UploadBodyLimit
from music_api.runtime_types import InferenceRuntime
from music_api.workflow_registry import WorkflowRegistry


log = logging.getLogger("music_api")


def session_for(request: Request) -> Iterator[Session]:
    database: Database = request.app.state.database
    with database.sessions() as session:
        yield session


def project_in(session: Session, identifier: UUID) -> Project:
    project = session.get(Project, str(identifier))
    if project is None:
        raise DomainError(404, "project_not_found", "Project does not exist.", "Select an existing Project or create one.")
    return project


def asset_in(session: Session, project_id: UUID, asset_id: UUID) -> Asset:
    project_in(session, project_id)
    asset = session.scalar(select(Asset).where(Asset.id == str(asset_id), Asset.project_id == str(project_id)))
    if asset is None:
        raise DomainError(404, "asset_not_found", "Asset does not exist in this Project.", "Select an Asset belonging to this Project.")
    return asset


def asset_file(storage: Storage, asset: Asset) -> Path:
    expected = asset.project_id + "/" + asset.id + "." + asset.format
    if asset.storage_key != expected:
        raise DomainError(409, "asset_path_invalid", "Asset file mapping does not match its Project and id.",
                          "Ask the owner to restore this Asset's metadata from a backup.", UUID(asset.id))
    return storage.readable(asset.storage_key, asset.size_bytes)


def create_app(settings: Settings | None = None, runtime: InferenceRuntime | None = None,
               configure_jobs: Callable[[JobService], None] | None = None, registry: WorkflowRegistry | None = None) -> FastAPI:
    from music_api.fake_generation import generation_fixture
    from music_api.generation import configure_generation, router as generation_router
    from music_api.version_routes import router as version_router
    from music_api.reference_audio import ReferenceOriginRead, reference_origin, router as reference_router

    configured = settings or Settings()
    event_broker = JobEventBroker()
    registry = registry or WorkflowRegistry()
    selected_runtime: InferenceRuntime = runtime or (FakeInferenceRuntime(registry=registry, max_age_seconds=configured.diagnostics_max_age_seconds,
                                                                          result_factories={"Generate": generation_fixture, "GenerateFromScore": generation_fixture})
                                                    if configured.runtime_mode == "fake" else ComfyUIRuntime(configured, registry))
    if selected_runtime.mode != configured.runtime_mode:
        raise ValueError("Injected Runtime mode differs from the configured data namespace")

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        database = Database(configured)
        jobs = None
        try:
            database.migrate()
            app.state.database = database
            app.state.storage = Storage(configured)
            jobs = JobService(database, app.state.storage, selected_runtime, registry, configured)
            app.state.jobs = jobs
            jobs.on_change = event_broker.publish
            jobs.subscription_factory = selected_runtime.subscribe
            configure_generation(jobs)
            if configure_jobs is not None:
                configure_jobs(jobs)
            jobs.start()
            yield
        finally:
            if jobs is not None:
                jobs.close()
            event_broker.close()
            database.close()

    app = MusicAPI(title="Music Application API", version="0.1.0", lifespan=lifespan,
                  responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})
    app.state.settings, app.state.runtime, app.state.registry = configured, selected_runtime, registry
    app.state.job_events = event_broker
    app.include_router(event_router)
    app.add_exception_handler(DomainError, domain_error_response)
    app.add_exception_handler(RequestValidationError, validation_error_response)
    app.add_exception_handler(HTTPException, http_error_response)
    app.add_exception_handler(SQLAlchemyError, dependency_error_response)
    app.add_exception_handler(OSError, dependency_error_response)
    app.add_middleware(UploadBodyLimit, max_upload_bytes=configured.max_upload_bytes)
    app.include_router(diagnostics_router)

    @app.post("/projects", response_model=ProjectRead, status_code=201)
    def create_project(value: ProjectCreate, session: Session = Depends(session_for)) -> ProjectRead:
        project = Project(id=str(uuid4()), name=value.name, description=value.description)
        try:
            session.add(project)
            session.commit()
        except SQLAlchemyError as error:
            log.exception("Project persistence failed", extra={"event": "project_commit_failed", "project_id": project.id})
            raise DomainError(503, "project_persistence_failed", "Project could not be saved.", "Read Projects before retrying.") from error
        return ProjectRead.model_validate(project)

    @app.get("/projects", response_model=list[ProjectRead])
    def list_projects(session: Session = Depends(session_for)) -> list[ProjectRead]:
        return [ProjectRead.model_validate(row) for row in session.scalars(select(Project).order_by(Project.created_at, Project.id))]

    @app.get("/projects/{project_id}", response_model=ProjectRead)
    def get_project(project_id: UUID, session: Session = Depends(session_for)) -> ProjectRead:
        return ProjectRead.model_validate(project_in(session, project_id))

    @app.post("/projects/{project_id}/assets", response_model=AssetRead, status_code=201,
              responses={413: {"model": ErrorResponse}, 422: {"model": ErrorResponse}})
    def upload_audio(project_id: UUID, file: UploadFile, request: Request,
                     session: Session = Depends(session_for)) -> AssetRead:
        project_in(session, project_id)
        asset = import_audio(request.app.state.database, session, request.app.state.storage, project_id, file.filename, file.file)
        return AssetRead.model_validate(asset)

    @app.get("/projects/{project_id}/assets", response_model=list[AssetRead], responses={409: {"model": ErrorResponse}})
    def list_assets(project_id: UUID, request: Request, session: Session = Depends(session_for)) -> list[AssetRead]:
        project_in(session, project_id)
        storage: Storage = request.app.state.storage
        rows = session.scalars(select(Asset).where(Asset.project_id == str(project_id)).order_by(Asset.created_at, Asset.id))
        result = []
        for asset in rows:
            asset_file(storage, asset)
            result.append(AssetRead.model_validate(asset))
        return result

    @app.get("/projects/{project_id}/assets/{asset_id}", response_model=AssetRead, responses={409: {"model": ErrorResponse}})
    def get_asset(project_id: UUID, asset_id: UUID, request: Request, session: Session = Depends(session_for)) -> AssetRead:
        asset = asset_in(session, project_id, asset_id)
        storage: Storage = request.app.state.storage
        asset_file(storage, asset)
        return AssetRead.model_validate(asset)

    @app.get("/projects/{project_id}/assets/{asset_id}/content", response_class=FileResponse,
             responses={200: {"content": {media: {"schema": {"type": "string", "format": "binary"}}
                                         for media in ("audio/wav", "audio/flac", "text/vnd.abc", "audio/midi")}},
                        409: {"model": ErrorResponse}})
    def download_asset(project_id: UUID, asset_id: UUID, request: Request,
                       session: Session = Depends(session_for)) -> FileResponse:
        asset = asset_in(session, project_id, asset_id)
        storage: Storage = request.app.state.storage
        return FileResponse(asset_file(storage, asset), media_type=asset.media_type, filename=asset.original_name)

    @app.post("/projects/{project_id}/transcriptions", response_model=JobRead, status_code=202)
    def create_transcription(project_id: UUID, value: TranscribeCreate, request: Request,
                             session: Session = Depends(session_for)) -> JobRead:
        reference = asset_in(session, project_id, value.reference_asset_id)
        if reference.kind != "reference_audio":
            raise DomainError(422, "reference_audio_required", "Choose uploaded Reference Audio.", "Upload the original supported PCM WAV first.")
        path = asset_file(request.app.state.storage, reference)
        facts = inspect_wav(path, configured.max_audio_seconds)
        if facts.sample_width_bits != 16 or facts.decoded_frames != facts.sample_rate * 16 or (facts.channels, facts.sample_rate) not in {(2, 48000), (1, 24000)}:
            raise DomainError(422, "reference_profile_unsupported", "Transcription currently supports T16 PCM16 stereo48k or mono24k only.", "Export a tested profile; the upload byte/duration budget does not prove inference support.")
        actual_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual_hash != reference.sha256:
            raise DomainError(409, "asset_unavailable", "Reference Audio differs from its recorded original bytes.", "Restore the original Asset before inference.")
        inputs: dict[str, object] = dict(reference_asset_id=reference.id, reference_sha256=actual_hash,
                                         duration_seconds=facts.duration_seconds, sample_rate=facts.sample_rate, channels=facts.channels, sample_width_bits=facts.sample_width_bits,
                                         decoded_frames=facts.decoded_frames)
        origin = reference_origin(session, reference)
        if origin is not None:
            inputs["reference_origin"] = ReferenceOriginRead.model_validate(origin).model_dump(mode="json")
        jobs: JobService = request.app.state.jobs
        return job_read(jobs.submit(project_id, "Transcribe", inputs))

    @app.get("/projects/{project_id}/jobs", response_model=list[JobRead])
    def list_jobs(project_id: UUID, session: Session = Depends(session_for)) -> list[JobRead]:
        project_in(session, project_id)
        return [job_read(job) for job in session.scalars(select(Job).where(Job.project_id == str(project_id)).order_by(Job.created_at, Job.id))]

    @app.get("/projects/{project_id}/jobs/{job_id}", response_model=JobRead)
    def get_job(project_id: UUID, job_id: UUID, session: Session = Depends(session_for)) -> JobRead:
        project_in(session, project_id)
        job = session.scalar(select(Job).where(Job.id == str(job_id), Job.project_id == str(project_id)))
        if job is None:
            raise DomainError(404, "job_not_found", "Job does not exist in this Project.", "Query the Job's owning Project.")
        return job_read(job)

    @app.post("/projects/{project_id}/jobs/{job_id}/cancel", response_model=JobRead,
              responses={202: {"model": JobRead}, 409: {"model": ErrorResponse}})
    def cancel_job(project_id: UUID, job_id: UUID, request: Request, response: Response) -> JobRead:
        jobs: JobService = request.app.state.jobs
        job = jobs.cancel(project_id, job_id)
        response.status_code = 202 if job.status in {"queued", "running"} else 200
        return job_read(job)

    @app.post("/projects/{project_id}/jobs/{job_id}/retry", response_model=JobRead, status_code=202,
              responses={409: {"model": ErrorResponse}})
    def retry_job(project_id: UUID, job_id: UUID, request: Request) -> JobRead:
        jobs: JobService = request.app.state.jobs
        return job_read(jobs.retry(project_id, job_id))

    @app.post("/projects/{project_id}/scores/validate", response_model=ScoreValidationRead)
    def validate_edited_score(project_id: UUID, value: ScoreValidate, session: Session = Depends(session_for)) -> ScoreValidationRead:
        project_in(session, project_id)
        return ScoreValidationRead.model_validate(selected_score_validation(value.abc))

    @app.post("/projects/{project_id}/scores", response_model=ScoreRead, status_code=201,
              responses={200: {"model": ScoreRead}, 409: {"model": ErrorResponse}})
    def create_edited_score(project_id: UUID, value: ScoreCreate, request: Request, response: Response, session: Session = Depends(session_for)) -> ScoreRead:
        # Reserve this writer before the first Project/source read.
        session.execute(update(Project).where(Project.id == str(project_id)).values(id=Project.id))
        project_in(session, project_id)
        score, created = save_score(request.app.state.database, session, request.app.state.storage, project_id, value)
        response.status_code = 201 if created else 200
        return ScoreRead.model_validate(score)

    @app.get("/projects/{project_id}/scores", response_model=list[ScoreRead])
    def list_scores(project_id: UUID, session: Session = Depends(session_for)) -> list[ScoreRead]:
        project_in(session, project_id)
        return [ScoreRead.model_validate(score) for score in session.scalars(select(Score).where(Score.project_id == str(project_id)).order_by(Score.created_at, Score.id))]

    @app.get("/projects/{project_id}/scores/{score_id}", response_model=ScoreRead)
    def get_score(project_id: UUID, score_id: UUID, session: Session = Depends(session_for)) -> ScoreRead:
        project_in(session, project_id)
        score = session.scalar(select(Score).where(Score.id == str(score_id), Score.project_id == str(project_id)))
        if score is None:
            raise DomainError(404, "score_not_found", "Score does not exist in this Project.", "Query the Score's owning Project.")
        return ScoreRead.model_validate(score)

    app.include_router(generation_router)
    app.include_router(version_router)
    app.include_router(reference_router)
    return app
