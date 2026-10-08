"""Create an immutable supported Reference from the actual saved Version audio."""

from io import BytesIO
import hashlib
import logging
from uuid import UUID, uuid4
import wave

import av
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, update
from sqlalchemy.orm import Mapped, Session, mapped_column

from music_api.audio import inspect_wav
from music_api.database import Asset, Base, Database, Project
from music_api.errors import DomainError
from music_api.generation_audio import validate_flac
from music_api.schemas import AssetRead, ErrorResponse
from music_api.storage import Storage, discard_owned
from music_api.version_models import Version


class ReferenceOrigin(Base):
    __tablename__ = "reference_origins"
    __table_args__ = (CheckConstraint("start_frame = 0 AND frame_count = 768000 AND sample_rate = 48000", name="ck_reference_origin_profile"),)
    reference_asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id", ondelete="RESTRICT"), primary_key=True)
    source_version_id: Mapped[str] = mapped_column(ForeignKey("versions.id", ondelete="RESTRICT"))
    source_asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id", ondelete="RESTRICT"))
    source_sha256: Mapped[str] = mapped_column(String(64))
    start_frame: Mapped[int] = mapped_column(Integer)
    frame_count: Mapped[int] = mapped_column(Integer)
    sample_rate: Mapped[int] = mapped_column(Integer)
    derivation_version: Mapped[str] = mapped_column(String(32))


class ReferenceOriginRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    reference_asset_id: UUID
    source_version_id: UUID
    source_asset_id: UUID
    source_sha256: str
    start_frame: int
    frame_count: int
    sample_rate: int
    derivation_version: str


class VersionReferenceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_version_id: UUID
    save_id: UUID = Field(default_factory=uuid4, description="Immutable Reference save intent. Identical replay returns the same first16s PCM WAV.")


def reference_origin(session: Session, reference: Asset) -> ReferenceOrigin | None:
    origin = session.get(ReferenceOrigin, reference.id)
    if origin is None:
        return None
    version = session.get(Version, origin.source_version_id)
    audio = session.get(Asset, origin.source_asset_id)
    if (reference.kind != "reference_audio" or version is None or audio is None
            or version.project_id != reference.project_id or audio.project_id != reference.project_id
            or version.audio_asset_id != audio.id or audio.kind != "generated_audio" or audio.sha256 != origin.source_sha256):
        raise DomainError(409, "reference_origin_invalid", "Reference source does not match its saved Version audio.", "Restore the original source relation; do not assign a different parent.")
    return origin


def first_reference_wav(data: bytes) -> bytes:
    validate_flac(data)
    parts: list[bytes] = []
    remaining = 768000
    with av.open(BytesIO(data), format="flac", mode="r") as container:
        for frame in container.decode(audio=0):
            samples = frame.to_ndarray()
            # Validated pinned FLAC decodes packed signed16 stereo, interleaved.
            if frame.format.name != "s16" or samples.shape != (1, frame.samples * 2):
                raise DomainError(422, "reference_conversion_failed", "Saved Audio has an unsupported PCM decoder layout.", "Retain the source Version and inspect its verified audio profile.")
            take = min(remaining, frame.samples)
            parts.append(samples[:, :take * 2].astype("<i2", copy=False).tobytes())
            remaining -= take
            if remaining == 0:
                break
    if remaining:
        raise DomainError(422, "reference_conversion_failed", "Saved Audio has less than16 seconds of complete PCM.", "Use a supported saved Version; no padding or alternate source is applied.")
    target = BytesIO()
    with wave.open(target, "wb") as writer:
        writer.setnchannels(2)
        writer.setsampwidth(2)
        writer.setframerate(48000)
        writer.writeframes(b"".join(parts))
    return target.getvalue()


log = logging.getLogger("music_api")


def derive_reference(database: Database, session: Session, storage: Storage, project_id: UUID, value: VersionReferenceCreate) -> tuple[Asset, bool]:
    from music_api.main import asset_file, project_in
    session.execute(update(Project).where(Project.id == str(project_id)).values(id=Project.id))
    project_in(session, project_id)
    version = session.get(Version, str(value.source_version_id))
    if version is None or version.project_id != str(project_id):
        raise DomainError(404, "version_not_found", "Source Version does not exist in this Project.", "Choose a saved Version from this Project.")
    source = session.get(Asset, version.audio_asset_id)
    if source is None or source.project_id != str(project_id) or source.kind != "generated_audio":
        raise DomainError(409, "reference_origin_invalid", "Source Version audio is unavailable.", "Restore its actual Audio Asset before creating a reference.")
    identifier = str(value.save_id)
    existing = session.get(Asset, identifier)
    if existing is not None:
        origin = reference_origin(session, existing) if existing.project_id == str(project_id) else None
        if origin is None or origin.source_version_id != version.id or origin.source_asset_id != source.id:
            raise DomainError(409, "reference_save_conflict", "This save id belongs to another immutable Reference intent.", "Read the existing Reference or use a new explicit save intent.", value.save_id)
        path = asset_file(storage, existing)
        if hashlib.sha256(path.read_bytes()).hexdigest() != existing.sha256:
            raise DomainError(409, "asset_unavailable", "Saved Reference bytes differ from its original hash.", "Restore the original file; do not overwrite it.", value.save_id)
        return existing, False
    data = asset_file(storage, source).read_bytes()
    if hashlib.sha256(data).hexdigest() != source.sha256:
        raise DomainError(409, "asset_unavailable", "Source Audio differs from its recorded original bytes.", "Restore the source Version Audio before deriving a Reference.")
    wav = first_reference_wav(data)
    stage = storage.stage(BytesIO(wav))
    published = None
    keep = False
    try:
        facts = inspect_wav(stage.path, database.settings.max_audio_seconds)
        key = str(project_id) + "/" + identifier + ".wav"
        published = storage.publish(stage, key)
        asset = Asset(id=identifier, project_id=str(project_id), kind="reference_audio", original_name="version-first16s.wav",
                      storage_key=key, format="wav", media_type="audio/wav", size_bytes=stage.size_bytes, sha256=stage.sha256,
                      duration_seconds=facts.duration_seconds, channels=facts.channels, sample_rate=facts.sample_rate, sample_width_bits=facts.sample_width_bits)
        session.add(asset)
        session.flush()
        origin = ReferenceOrigin(reference_asset_id=identifier, source_version_id=version.id, source_asset_id=source.id,
                                 source_sha256=source.sha256, start_frame=0, frame_count=768000, sample_rate=48000, derivation_version="1.0.0")
        session.add(origin)
        session.commit()
        keep = True
        return asset, True
    except Exception as error:
        rollback_known = True
        try:
            session.rollback()
        except Exception:
            rollback_known = False
        try:
            keep = database.asset_persisted(identifier) or not rollback_known
        except Exception:
            keep = True
        log.exception("Reference creation acknowledgement failed", extra={"event": "reference_commit_failed", "asset_id": identifier})
        if keep:
            raise DomainError(503, "reference_commit_unconfirmed", "Reference creation acknowledgement is unavailable; its file is retained.", "Read this Reference id or replay the identical save intent.", value.save_id) from error
        raise DomainError(503, "reference_save_failed", "Reference creation failed without a saved Asset.", "Retain the Version and retry the same save intent after storage recovers.", value.save_id) from error
    finally:
        for path in [stage.path] + ([published] if published is not None and not keep else []):
            discard_owned(path)


from music_api.main import asset_in, session_for

router = APIRouter(responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})


@router.post("/projects/{project_id}/reference-audio/from-version", response_model=AssetRead, status_code=201, responses={200: {"model": AssetRead}})
def create_reference(project_id: UUID, value: VersionReferenceCreate, request: Request, response: Response, session: Session = Depends(session_for)) -> AssetRead:
    asset, created = derive_reference(request.app.state.database, session, request.app.state.storage, project_id, value)
    response.status_code = 201 if created else 200
    return AssetRead.model_validate(asset)


@router.get("/projects/{project_id}/assets/{asset_id}/reference-origin", response_model=ReferenceOriginRead | None)
def read_reference_origin(project_id: UUID, asset_id: UUID, session: Session = Depends(session_for)) -> ReferenceOriginRead | None:
    reference = asset_in(session, project_id, asset_id)
    origin = reference_origin(session, reference)
    return ReferenceOriginRead.model_validate(origin) if origin else None
