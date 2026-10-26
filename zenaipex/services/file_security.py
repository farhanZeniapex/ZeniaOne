"""Defensive checks for user-provided knowledge-base files.

This is intentionally a lightweight pre-parser guard. It rejects common
archive abuse and active-content markers before a file reaches extractors.
It is not a replacement for an enterprise malware scanner such as ClamAV.
"""

from __future__ import annotations

from io import BytesIO
from pathlib import PurePosixPath
import zipfile


class UnsafeUploadError(ValueError):
    """Raised when an uploaded file contains a dangerous structure."""


def scan_document_upload(filename: str, content_type: str, content: bytes) -> None:
    """Reject path traversal, archive bombs, macros and obvious active content."""
    name = (filename or "").strip()
    lower_name = name.lower()
    if not name or "\x00" in name or len(name) > 255:
        raise UnsafeUploadError("Invalid filename.")

    if lower_name.endswith(".pdf") or "pdf" in (content_type or "").lower():
        # These markers catch common active-PDF payloads before parsing. A
        # normal text PDF does not contain executable JavaScript markers.
        upper = content[:10 * 1024 * 1024].upper()
        if b"/JAVASCRIPT" in upper or b"/JS" in upper:
            raise UnsafeUploadError("PDF active content is not allowed.")

    if not (lower_name.endswith(".docx") or "wordprocessingml" in (content_type or "").lower()):
        return

    try:
        archive = zipfile.ZipFile(BytesIO(content))
    except zipfile.BadZipFile as exc:
        raise UnsafeUploadError("Invalid DOCX archive.") from exc

    total_uncompressed = 0
    for member in archive.infolist():
        path = PurePosixPath(member.filename)
        if path.is_absolute() or ".." in path.parts:
            raise UnsafeUploadError("DOCX contains an unsafe path.")
        if member.filename.lower().endswith("vbaproject.bin"):
            raise UnsafeUploadError("DOCX macros are not allowed.")
        compressed = max(member.compress_size, 1)
        if member.file_size / compressed > 1000:
            raise UnsafeUploadError("DOCX compression ratio is unsafe.")
        total_uncompressed += member.file_size
        if total_uncompressed > 100 * 1024 * 1024:
            raise UnsafeUploadError("DOCX expands beyond the safe size limit.")

    names = {member.filename for member in archive.infolist()}
    if "[Content_Types].xml" not in names or "word/document.xml" not in names:
        raise UnsafeUploadError("DOCX structure is invalid.")
