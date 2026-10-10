"""The server owns pairing state; phones choose credentials before claiming."""

import hashlib
import hmac
import secrets
import time
from uuid import UUID, uuid4

from fastapi import APIRouter, Request, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from music_api.database import Database
from music_api.errors import DomainError
from music_api.pairing_models import Device, PairingChallenge, ServerIdentity
from music_api.pairing_schemas import (ChallengeCreated, ChallengeRead, ConnectionRead,
                                       DeviceConnectionRead, DeviceRead, OwnerRead, PairingClaim)
from music_api.schemas import ErrorResponse


router = APIRouter(tags=["Device pairing"])


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("ascii")).hexdigest()


def challenge_read(value: PairingChallenge) -> ChallengeRead:
    return ChallengeRead(id=UUID(value.id), expires_at=value.expires_at,
                         attempts_remaining=5 - value.attempts, status=value.status)


def pairing_failure(code: str, status: int = 403) -> DomainError:
    return DomainError(status, code, "Device pairing was not accepted.",
                       "Check the computer's current pairing window, or create a new window locally.")


class PairingService:
    def __init__(self, database: Database) -> None:
        self.database = database
        self.owner_csrf = secrets.token_hex(32)
        with database.sessions() as session:
            identity = session.get(ServerIdentity, 1)
            if identity is None:
                identity = ServerIdentity(singleton=1, server_id=str(uuid4()))
                session.add(identity)
                session.commit()
            self.server_id = identity.server_id

    def reserve_writer(self, session: Session) -> None:
        # Obtain SQLite's write reservation before reading or consuming a code.
        session.execute(update(ServerIdentity).where(ServerIdentity.singleton == 1).values(singleton=1))

    def current(self, session: Session) -> PairingChallenge | None:
        return session.scalar(select(PairingChallenge).order_by(PairingChallenge.sequence.desc()).limit(1))

    def connection(self) -> ConnectionRead:
        with self.database.sessions() as session:
            value = self.current(session)
            available = self.database.settings.lan_host is not None and value is not None and value.status == "active" and value.expires_at > time.time()
        return ConnectionRead(server_id=UUID(self.server_id), pairing_available=available)

    def owner(self) -> OwnerRead:
        configured = self.database.settings
        with self.database.sessions() as session:
            value = self.current(session)
            return OwnerRead(server_id=UUID(self.server_id), owner_csrf=self.owner_csrf,
                             lan_address=f"http://{configured.lan_host}:{configured.lan_port}" if configured.lan_host else None,
                             challenge=challenge_read(value) if value else None)

    def create_challenge(self) -> ChallengeCreated:
        if self.database.settings.lan_host is None:
            raise DomainError(409, "lan_disabled", "The LAN listener is disabled.", "Restart with an explicitly selected local IPv4 address.")
        now, identifier, code = time.time(), str(uuid4()), f"{secrets.randbelow(1000000):06d}"
        with self.database.sessions() as session:
            self.reserve_writer(session)
            session.execute(update(PairingChallenge).where(PairingChallenge.status == "active").values(status="closed"))
            value = PairingChallenge(id=identifier, code_digest=digest(identifier + ":" + code), created_at=now,
                                     expires_at=now + 120, attempts=0, status="active")
            session.add(value)
            session.commit()
            return ChallengeCreated(**challenge_read(value).model_dump(), code=code)

    def close_challenge(self) -> None:
        with self.database.sessions() as session:
            self.reserve_writer(session)
            session.execute(update(PairingChallenge).where(PairingChallenge.status == "active").values(status="closed"))
            session.commit()

    def claim(self, value: PairingClaim) -> tuple[DeviceConnectionRead, bool]:
        token_digest = digest(value.device_token)
        with self.database.sessions() as session:
            self.reserve_writer(session)
            device = session.get(Device, str(value.device_id))
            if device is not None:
                original = session.scalar(select(PairingChallenge).where(PairingChallenge.claimed_device_id == device.id))
                if device.revoked_at is None and original is not None and device.name == value.device_name \
                        and hmac.compare_digest(device.token_digest, token_digest) \
                        and hmac.compare_digest(original.code_digest, digest(original.id + ":" + value.code)):
                    return DeviceConnectionRead(server_id=UUID(self.server_id), device=DeviceRead.model_validate(device)), False
                raise pairing_failure("pairing_conflict", 409)
            challenge = self.current(session)
            if challenge is None or challenge.status in {"closed", "consumed"}:
                raise pairing_failure("pairing_unavailable", 410)
            if challenge.status == "locked":
                raise pairing_failure("pairing_locked", 429)
            if challenge.expires_at <= time.time():
                raise pairing_failure("pairing_expired", 410)
            if not hmac.compare_digest(challenge.code_digest, digest(challenge.id + ":" + value.code)):
                challenge.attempts += 1
                if challenge.attempts == 5:
                    challenge.status = "locked"
                session.commit()  # A rejected attempt must remain rejected across restart.
                raise pairing_failure("pairing_locked" if challenge.status == "locked" else "pairing_invalid", 429 if challenge.status == "locked" else 403)
            device = Device(id=str(value.device_id), name=value.device_name, token_digest=token_digest,
                            created_at=time.time(), revoked_at=None)
            session.add(device)
            try:
                session.flush()
                challenge.status, challenge.claimed_device_id = "consumed", device.id
                session.commit()
            except IntegrityError:
                raise pairing_failure("pairing_conflict", 409) from None
            return DeviceConnectionRead(server_id=UUID(self.server_id), device=DeviceRead.model_validate(device)), True

    def authenticate(self, authorization: str | None) -> DeviceRead:
        if authorization is None or not authorization.startswith("Bearer "):
            raise DomainError(401, "device_unauthorized", "Device authorization is required.", "Pair this device from the computer.")
        token = authorization[7:]
        if len(token) != 64 or any(character not in "0123456789abcdef" for character in token):
            raise DomainError(401, "device_unauthorized", "Device authorization is invalid.", "Pair this device again from the computer.")
        with self.database.sessions() as session:
            device = session.scalar(select(Device).where(Device.token_digest == digest(token), Device.revoked_at.is_(None)))
            if device is None:
                raise DomainError(401, "device_unauthorized", "Device authorization is invalid or revoked.", "Pair this device again from the computer.")
            return DeviceRead.model_validate(device)

    def devices(self) -> list[DeviceRead]:
        with self.database.sessions() as session:
            return [DeviceRead.model_validate(value) for value in session.scalars(select(Device).order_by(Device.created_at, Device.id))]

    def revoke(self, identifier: UUID) -> DeviceRead:
        with self.database.sessions() as session:
            self.reserve_writer(session)
            device = session.get(Device, str(identifier))
            if device is None:
                raise DomainError(404, "device_not_found", "Device does not exist.", "Read the computer's device list.")
            if device.revoked_at is None:
                device.revoked_at = time.time()
                session.commit()
            return DeviceRead.model_validate(device)


@router.get("/connection", response_model=ConnectionRead)
def connection(request: Request) -> ConnectionRead:
    pairing: PairingService = request.app.state.pairing
    return pairing.connection()


@router.get("/device", response_model=DeviceConnectionRead)
def current_device(request: Request) -> DeviceConnectionRead:
    pairing: PairingService = request.app.state.pairing
    device = pairing.authenticate(request.headers.get("authorization"))
    return DeviceConnectionRead(server_id=UUID(pairing.server_id), device=device)


@router.get("/pairing/owner", response_model=OwnerRead)
def pairing_owner(request: Request) -> OwnerRead:
    pairing: PairingService = request.app.state.pairing
    return pairing.owner()


@router.post("/pairing/challenges", response_model=ChallengeCreated, status_code=201, responses={409: {"model": ErrorResponse}})
def create_challenge(request: Request) -> ChallengeCreated:
    pairing: PairingService = request.app.state.pairing
    return pairing.create_challenge()


@router.delete("/pairing/challenges/current", status_code=204)
def close_challenge(request: Request) -> Response:
    pairing: PairingService = request.app.state.pairing
    pairing.close_challenge()
    return Response(status_code=204)


@router.post("/pairing/claim", response_model=DeviceConnectionRead, status_code=201,
             description="device_id identifies an authorization record. After revocation, explicitly pair with a fresh UUID and token. To recover an uncertain initial claim, replay the exact frozen UUID/token/name/code; a consumed or expired window does not renew credentials.",
             responses={200: {"model": DeviceConnectionRead}, **{status: {"model": ErrorResponse} for status in (409, 410, 429)}})
def claim_device(value: PairingClaim, request: Request, response: Response) -> DeviceConnectionRead:
    pairing: PairingService = request.app.state.pairing
    result, created = pairing.claim(value)
    response.status_code = 201 if created else 200
    return result


@router.get("/pairing/devices", response_model=list[DeviceRead])
def paired_devices(request: Request) -> list[DeviceRead]:
    pairing: PairingService = request.app.state.pairing
    return pairing.devices()


@router.delete("/pairing/devices/{device_id}", response_model=DeviceRead)
async def revoke_device(device_id: UUID, request: Request) -> DeviceRead:
    pairing: PairingService = request.app.state.pairing
    value = await run_in_threadpool(pairing.revoke, device_id)
    request.app.state.access.revoke(str(device_id))
    return value
