"""Small, dependency-free validators for user-uploaded media."""

from fastapi import HTTPException


def validate_image_upload(content: bytes, content_type: str, *, max_bytes: int = 2 * 1024 * 1024) -> None:
    """Validate image size, declared type, magic bytes, and safe SVG content."""
    if not content:
        raise HTTPException(status_code=400, detail="Image file is empty.")
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail="Logo too large. Maximum size is 2MB.")

    allowed = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
    if content_type not in allowed:
        raise HTTPException(status_code=400, detail="Invalid image type. Use JPG, PNG, WEBP, GIF, or SVG.")

    signatures = {
        "image/jpeg": content.startswith(b"\xff\xd8\xff"),
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/gif": content.startswith((b"GIF87a", b"GIF89a")),
        "image/webp": content.startswith(b"RIFF") and content[8:12] == b"WEBP",
    }
    if content_type != "image/svg+xml" and not signatures.get(content_type, False):
        raise HTTPException(status_code=400, detail="Image content does not match its file type.")

    if content_type == "image/svg+xml":
        text = content.decode("utf-8", errors="ignore").lower()
        blocked = ("<script", "javascript:", " onload=", " onerror=", " onclick=", "<iframe")
        if not text.lstrip().startswith("<svg") or any(token in text for token in blocked):
            raise HTTPException(status_code=400, detail="Unsafe SVG content rejected.")
