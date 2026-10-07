"""Candidate inspection and explicit save/read remain ordinary application HTTP."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from music_api.database import Database
from music_api.generation_schemas import CandidateRead, VersionRead, VersionSave
from music_api.main import project_in, session_for
from music_api.schemas import ErrorResponse
from music_api.storage import Storage
from music_api.version_models import Candidate, Version
from music_api.versions import candidate_in, readable_outputs, save_version, version_in


router = APIRouter(responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})


@router.get("/projects/{project_id}/candidates", response_model=list[CandidateRead])
def list_candidates(project_id: UUID, request: Request, session: Session = Depends(session_for)) -> list[CandidateRead]:
    project_in(session, project_id)
    storage: Storage = request.app.state.storage
    rows = session.scalars(select(Candidate).where(Candidate.project_id == str(project_id)).order_by(Candidate.created_at, Candidate.id))
    results = []
    for candidate in rows:
        readable_outputs(session, storage, candidate)
        results.append(CandidateRead.model_validate(candidate))
    return results


@router.get("/projects/{project_id}/candidates/{candidate_id}", response_model=CandidateRead)
def get_candidate(project_id: UUID, candidate_id: UUID, request: Request, session: Session = Depends(session_for)) -> CandidateRead:
    candidate = candidate_in(session, project_id, candidate_id)
    readable_outputs(session, request.app.state.storage, candidate)
    return CandidateRead.model_validate(candidate)


@router.post("/projects/{project_id}/versions", response_model=VersionRead, status_code=201,
             responses={200: {"model": VersionRead}})
def create_version(project_id: UUID, value: VersionSave, request: Request, response: Response,
                   session: Session = Depends(session_for)) -> VersionRead:
    database: Database = request.app.state.database
    storage: Storage = request.app.state.storage
    # No earlier Project read: save's first DML must acquire the writer slot first.
    version, created = save_version(database, session, storage, project_id, value)
    response.status_code = 201 if created else 200
    return VersionRead.model_validate(version)


@router.get("/projects/{project_id}/versions", response_model=list[VersionRead])
def list_versions(project_id: UUID, request: Request, session: Session = Depends(session_for)) -> list[VersionRead]:
    project_in(session, project_id)
    storage: Storage = request.app.state.storage
    rows = session.scalars(select(Version).where(Version.project_id == str(project_id)).order_by(Version.created_at, Version.id))
    results = []
    for version in rows:
        readable_outputs(session, storage, version)
        results.append(VersionRead.model_validate(version))
    return results


@router.get("/projects/{project_id}/versions/{version_id}", response_model=VersionRead)
def get_version(project_id: UUID, version_id: UUID, request: Request, session: Session = Depends(session_for)) -> VersionRead:
    version = version_in(session, project_id, version_id)
    readable_outputs(session, request.app.state.storage, version)
    return VersionRead.model_validate(version)
