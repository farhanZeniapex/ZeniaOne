"""High-performance image optimization service for brand and workspace logos.

Converts raster images (PNG, JPEG, GIF, BMP) to modern, lightweight WebP format
while resizing them to a maximum dimension suitable for high-DPI displays.
Vector SVG images are preserved as-is.
"""

from __future__ import annotations

import io
import logging
from typing import Tuple
from PIL import Image

logger = logging.getLogger(__name__)


def optimize_logo_image(
    content: bytes,
    content_type: str,
    max_dimension: int = 800,
    quality: int = 85,
) -> Tuple[bytes, str, str]:
    """Optimize a logo image for high performance and low storage.

    Parameters:
        content: Raw uploaded image bytes.
        content_type: MIME type of the uploaded file.
        max_dimension: Maximum allowed width or height in pixels (default 800).
        quality: WebP quality setting (0-100, default 85).

    Returns:
        (optimized_bytes, mime_type, file_extension)
    """
    if not content:
        return content, content_type, "png"

    # SVG is already a vector format: keep original vector bytes
    clean_type = (content_type or "").lower().strip()
    if clean_type == "image/svg+xml" or content.lstrip().startswith(b"<svg"):
        return content, "image/svg+xml", "svg"

    try:
        img = Image.open(io.BytesIO(content))

        # Preserve alpha transparency channel if present
        if img.mode in ("RGBA", "LA") or ("transparency" in img.info):
            img = img.convert("RGBA")
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Downscale proportionally if larger than max_dimension
        orig_w, orig_h = img.size
        if max(orig_w, orig_h) > max_dimension:
            ratio = max_dimension / float(max(orig_w, orig_h))
            new_w = max(1, int(orig_w * ratio))
            new_h = max(1, int(orig_h * ratio))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            logger.info("Resized logo from %dx%d to %dx%d", orig_w, orig_h, new_w, new_h)

        # Encode to WebP
        out_buf = io.BytesIO()
        img.save(out_buf, format="WEBP", quality=quality, method=6)
        optimized_bytes = out_buf.getvalue()

        # If original was already WebP and is somehow smaller, preserve original
        if clean_type == "image/webp" and len(content) <= len(optimized_bytes):
            return content, "image/webp", "webp"

        logger.info(
            "Optimized logo: %d bytes -> %d bytes (%.1f%% reduction)",
            len(content),
            len(optimized_bytes),
            (1.0 - (len(optimized_bytes) / float(len(content)))) * 100.0 if len(content) else 0,
        )
        return optimized_bytes, "image/webp", "webp"

    except Exception as exc:
        logger.warning("Image optimization fallback: could not convert (%s)", exc)
        return content, content_type, "png"

