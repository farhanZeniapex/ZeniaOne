import pytest

from fastapi import HTTPException
from zenaipex.services.upload_validation import validate_image_upload


def test_png_signature_is_required():
    with pytest.raises(HTTPException):
        validate_image_upload(b"not-a-png", "image/png")


def test_unsafe_svg_is_rejected():
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    with pytest.raises(HTTPException):
        validate_image_upload(svg, "image/svg+xml")


def test_valid_svg_is_accepted():
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
    validate_image_upload(svg, "image/svg+xml")
