"""Durable server identity and revocable device authorization."""

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from typing import Literal

from music_api.database import Base


class ServerIdentity(Base):
    __tablename__ = "server_identity"

    singleton: Mapped[int] = mapped_column(Integer, primary_key=True)
    server_id: Mapped[str] = mapped_column(String(36), unique=True)


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    token_digest: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[float] = mapped_column(Float)
    revoked_at: Mapped[float | None] = mapped_column(Float)


class PairingChallenge(Base):
    __tablename__ = "pairing_challenges"

    sequence: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id: Mapped[str] = mapped_column(String(36), unique=True)
    code_digest: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[float] = mapped_column(Float)
    expires_at: Mapped[float] = mapped_column(Float)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[Literal["active", "closed", "consumed", "locked"]] = mapped_column(String(16))
    claimed_device_id: Mapped[str | None] = mapped_column(ForeignKey("devices.id", ondelete="RESTRICT"))
