"""Storage for uploaded files (lab reports, scans, patient documents).

Files are written to `UPLOAD_DIR` and served back from `/static/uploads`. The
service exists so that swapping local disk for S3/R2 later means changing one
class, not every caller.
"""

import re
import uuid
from pathlib import Path
from typing import BinaryIO

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import ValidationError

# Read the upload in chunks so a large file never sits in memory in one piece.
CHUNK_SIZE = 1024 * 1024  # 1 MB

# Subfolders are caller-supplied, so restrict them to a safe, flat alphabet.
SAFE_SUBFOLDER = re.compile(r"^[a-zA-Z0-9_-]{1,40}$")


class UploadService:
    def __init__(self, base_dir: Path | None = None):
        self.base_dir = base_dir or Path(settings.UPLOAD_DIR).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _target_dir(self, subfolder: str) -> Path:
        """Resolve the destination directory, refusing anything outside base_dir."""
        if not subfolder:
            return self.base_dir

        if not SAFE_SUBFOLDER.match(subfolder):
            raise ValidationError(
                "Folder name may only contain letters, numbers, hyphens and underscores."
            )

        target = (self.base_dir / subfolder).resolve()
        if not target.is_relative_to(self.base_dir):
            raise ValidationError("Invalid upload folder.")

        target.mkdir(parents=True, exist_ok=True)
        return target

    @staticmethod
    def _validate_extension(filename: str) -> str:
        extension = Path(filename or "").suffix.lower()
        if not extension:
            raise ValidationError("File must have an extension.")
        if extension not in settings.upload_extensions:
            allowed = ", ".join(settings.upload_extensions)
            raise ValidationError(f"File type '{extension}' is not allowed. Allowed types: {allowed}")
        return extension

    async def save(self, file: UploadFile, subfolder: str = "") -> dict:
        """Validate and persist an upload, returning its public URL."""
        extension = self._validate_extension(file.filename or "")
        target_dir = self._target_dir(subfolder)

        # A random name avoids collisions and stops a caller choosing the path.
        stored_name = f"{uuid.uuid4().hex}{extension}"
        destination = target_dir / stored_name

        size = await self._write_limited(file.file, destination)

        relative = destination.relative_to(self.base_dir).as_posix()
        return {
            "file_url": f"/static/uploads/{relative}",
            "file_name": file.filename,
            "stored_name": stored_name,
            "content_type": file.content_type,
            "size_bytes": size,
        }

    async def _write_limited(self, source: BinaryIO, destination: Path) -> int:
        """Stream to disk, aborting if the file exceeds the configured limit."""
        written = 0
        try:
            with destination.open("wb") as out:
                while chunk := source.read(CHUNK_SIZE):
                    written += len(chunk)
                    if written > settings.max_upload_bytes:
                        raise ValidationError(
                            f"File is larger than the {settings.MAX_UPLOAD_SIZE_MB} MB limit."
                        )
                    out.write(chunk)
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        return written

    def delete(self, file_url: str) -> bool:
        """Remove a previously uploaded file. Returns True if it existed."""
        prefix = "/static/uploads/"
        if not file_url.startswith(prefix):
            return False

        target = (self.base_dir / file_url[len(prefix) :]).resolve()
        if not target.is_relative_to(self.base_dir) or not target.is_file():
            return False

        target.unlink()
        return True
