"""SQLite metadata owner and explicit Alembic schema upgrade."""

from datetime import datetime, timezone
from pathlib import Path
import sqlite3

from alembic import command
from alembic.config import Config
from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, String, create_engine, event, select
from sqlalchemy.engine import Connection, URL
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from music_api.config import Settings


class Base(DeclarativeBase):
    pass


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String(2000), default="")
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (CheckConstraint("size_bytes > 0", name="ck_asset_file_size"),
                      CheckConstraint("kind NOT IN ('reference_audio','generated_audio') OR (duration_seconds IS NOT NULL AND duration_seconds > 0 AND channels IS NOT NULL AND channels IN (1,2) AND sample_rate IS NOT NULL AND sample_rate > 0)", name="ck_asset_audio_facts"),
                      CheckConstraint("kind != 'reference_audio' OR sample_width_bits IN (8,16,24,32) AND sample_width_bits IS NOT NULL", name="ck_reference_width"))

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    original_name: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(100), unique=True)
    format: Mapped[str] = mapped_column(String(16))
    media_type: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    channels: Mapped[int | None] = mapped_column(Integer)
    sample_rate: Mapped[int | None] = mapped_column(Integer)
    sample_width_bits: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)


def sqlite_pragmas(connection: sqlite3.Connection, record: object) -> None:
    # SQLAlchemy owns BEGIN so SQLite DDL participates in real rollback too.
    connection.isolation_level = None
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA busy_timeout=5000")


def sqlite_begin(connection: Connection) -> None:
    connection.exec_driver_sql("BEGIN")


class Database:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.engine = create_engine(URL.create("sqlite", database=str(settings.database_path)),
                                    connect_args={"check_same_thread": False, "timeout": 5})
        event.listen(self.engine, "connect", sqlite_pragmas)
        event.listen(self.engine, "begin", sqlite_begin)
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)

    def migrate(self) -> None:
        self.settings.database_path.parent.mkdir(parents=True, exist_ok=True)
        config = Config()
        config.set_main_option("script_location", str(Path(__file__).parent / "migrations"))
        with self.engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")

    def close(self) -> None:
        self.engine.dispose()

    def asset_persisted(self, identifier: str) -> bool:
        """A fresh transaction distinguishes failed commit from lost acknowledgement."""
        with self.engine.connect() as connection:
            return connection.execute(select(Asset.id).where(Asset.id == identifier)).first() is not None
