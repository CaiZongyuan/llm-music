"""Own only this upload's files; published content never overwrites an Asset."""

from dataclasses import dataclass
import hashlib
import logging
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import shutil
import tempfile
from typing import BinaryIO
from uuid import UUID

from music_api.config import Settings
from music_api.errors import DomainError


log = logging.getLogger("music_api")


def discard_owned(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError as error:
        log.exception("Owned upload cleanup failed", extra={"event": "asset_cleanup_failed", "owned_path": str(path)})
        raise DomainError(503, "storage_cleanup_failed", "Upload cleanup could not finish.",
                          "Query the Asset id first, retain the failed attempt's evidence and ask the owner to recover its isolated files.") from error


@dataclass(frozen=True)
class StagedFile:
    path: Path
    size_bytes: int
    sha256: str


def original_name(value: str | None) -> str:
    name = PurePosixPath(PureWindowsPath(value or "reference.wav").name).name
    if not name or len(name) > 255 or any(ord(character) < 32 for character in name):
        raise DomainError(422, "invalid_filename", "File name is invalid.", "Use a name of 1–255 characters without control characters.")
    return name


class Storage:
    def __init__(self, settings: Settings) -> None:
        settings.assets_root.mkdir(parents=True, exist_ok=True)
        self.root = settings.assets_root.resolve(strict=True)
        self.max_bytes = settings.max_upload_bytes

    def inside(self, path: Path) -> Path:
        try:
            resolved = path.resolve()
        except RuntimeError as error:
            raise DomainError(409, "asset_path_invalid", "Asset storage path cannot be resolved.",
                              "Ask the owner to restore the application storage hierarchy.") from error
        if not resolved.is_relative_to(self.root):
            raise DomainError(409, "asset_path_invalid", "Asset storage location is outside the application store.",
                              "Ask the owner to restore the application Asset metadata and storage.")
        return resolved

    def path_for(self, key: str) -> Path:
        parts = PurePosixPath(key).parts
        try:
            if len(parts) != 2 or str(UUID(parts[0])) != parts[0] or not parts[1].endswith(".wav") or str(UUID(parts[1][:-4])) + ".wav" != parts[1]:
                raise ValueError("Invalid server storage key")
        except (ValueError, AttributeError) as error:
            raise DomainError(409, "asset_path_invalid", "Asset storage key is invalid.",
                              "Ask the owner to restore this Asset's metadata from a backup.") from error
        return self.inside(self.root.joinpath(*parts))

    def stage(self, source: BinaryIO) -> StagedFile:
        folder = self.inside(self.root / ".staging")
        folder.mkdir(exist_ok=True)
        descriptor, name = tempfile.mkstemp(dir=folder, suffix=".part")
        path, digest, size = Path(name), hashlib.sha256(), 0
        try:
            with os.fdopen(descriptor, "wb") as target:
                while chunk := source.read(65536):
                    size += len(chunk)
                    if size > self.max_bytes:
                        raise DomainError(413, "upload_too_large", "File exceeds the configured byte budget.",
                                          "Upload a smaller file or ask the owner to configure the upload budget.")
                    target.write(chunk)
                    digest.update(chunk)
                target.flush()
                os.fsync(target.fileno())
            return StagedFile(path, size, digest.hexdigest())
        except Exception:
            discard_owned(path)
            raise

    def publish(self, staged: StagedFile, key: str) -> Path:
        target = self.path_for(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive creation prevents a failed attempt from overwriting/deleting older content.
        with target.open("xb") as handle:
            try:
                with staged.path.open("rb") as source:
                    shutil.copyfileobj(source, handle, 65536)
                handle.flush()
                os.fsync(handle.fileno())
            except Exception:
                handle.close()
                discard_owned(target)
                raise
        return target

    def readable(self, key: str, size: int) -> Path:
        path = self.path_for(key)
        if not path.is_file() or path.stat().st_size != size:
            raise DomainError(409, "asset_unavailable", "The stored Asset file is missing or incomplete.",
                              "Restore this Asset from a backup; do not overwrite it with a different file.")
        # Check current OS read access before metadata or FileResponse sends success headers.
        with path.open("rb") as source:
            if not source.read(1):
                raise DomainError(409, "asset_unavailable", "The stored Asset file is empty.",
                                  "Restore this Asset's original content from a backup.")
        return path
