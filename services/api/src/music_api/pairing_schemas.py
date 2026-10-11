"""Safe public representations never contain a persisted device credential."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ConnectionRead(BaseModel):
    server_id: UUID
    protocol_version: Literal[1] = 1
    access_method: Literal["direct"] = "direct"
    pairing_available: bool
    lan_address: str | None


class DeviceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    created_at: float
    revoked_at: float | None


class DeviceConnectionRead(BaseModel):
    server_id: UUID
    device: DeviceRead


class PairingClaim(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    device_id: UUID
    device_token: str = Field(pattern=r"^[0-9a-f]{64}$", description="32 securely generated random bytes encoded as exactly 64 lowercase hex characters.")
    device_name: str = Field(min_length=1, max_length=200)
    code: str = Field(pattern=r"^[0-9]{6}$")


class ChallengeRead(BaseModel):
    id: UUID
    expires_at: float
    attempts_remaining: int
    status: Literal["active", "closed", "consumed", "locked"]


class ChallengeCreated(ChallengeRead):
    code: str


class OwnerRead(BaseModel):
    server_id: UUID
    owner_csrf: str
    lan_address: str | None
    challenge: ChallengeRead | None
