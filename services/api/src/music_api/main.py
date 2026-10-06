"""Public local HTTP application; no GPU/Runtime imports or startup dependency."""

from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager
import logging
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from music_api.config import Settings
from music_api.assets import import_audio
from music_api.database import Asset, Database, Project
from music_api.errors import (DomainError, dependency_error_response, domain_error_response,
                              http_error_response, validation_error_response)
from music_api.schemas import AssetRead, ErrorResponse, ProjectCreate, ProjectRead
from music_api.storage import Storage
from music_api.upload_limit import UploadBodyLimit


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
    expected = asset.project_id + "/" + asset.id + ".wav"
    if asset.storage_key != expected:
        raise DomainError(409, "asset_path_invalid", "Asset file mapping does not match its Project and id.",
                          "Ask the owner to restore this Asset's metadata from a backup.", UUID(asset.id))
    return storage.readable(asset.storage_key, asset.size_bytes)


def create_app(settings: Settings | None = None) -> FastAPI:
    configured = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        database = Database(configured)
        try:
            database.migrate()
            app.state.database = database
            app.state.storage = Storage(configured)
            yield
        finally:
            database.close()

    app = FastAPI(title="Music Application API", version="0.1.0", lifespan=lifespan,
                  responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})
    app.add_exception_handler(DomainError, domain_error_response)
    app.add_exception_handler(RequestValidationError, validation_error_response)
    app.add_exception_handler(HTTPException, http_error_response)
    app.add_exception_handler(SQLAlchemyError, dependency_error_response)
    app.add_exception_handler(OSError, dependency_error_response)
    app.add_middleware(UploadBodyLimit, max_upload_bytes=configured.max_upload_bytes)

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
             responses={200: {"content": {"audio/wav": {"schema": {"type": "string", "format": "binary"}}}}, 409: {"model": ErrorResponse}})
    def download_asset(project_id: UUID, asset_id: UUID, request: Request,
                       session: Session = Depends(session_for)) -> FileResponse:
        asset = asset_in(session, project_id, asset_id)
        storage: Storage = request.app.state.storage
        return FileResponse(asset_file(storage, asset), media_type=asset.media_type, filename=asset.original_name)

    return app
