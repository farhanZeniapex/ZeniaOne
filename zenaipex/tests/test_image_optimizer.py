import io
import pytest
from PIL import Image
from zenaipex.services.image_optimizer import optimize_logo_image


def test_optimize_svg_preserved():
    svg_data = b'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle r="50"/></svg>'
    opt_data, opt_type, ext = optimize_logo_image(svg_data, "image/svg+xml")
    assert opt_type == "image/svg+xml"
    assert ext == "svg"
    assert opt_data == svg_data


def test_optimize_png_to_webp_and_resizes():
    # Create large 1600x1200 image
    img = Image.new("RGBA", (1600, 1200), (255, 100, 50, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    png_bytes = buf.getvalue()

    opt_bytes, opt_type, ext = optimize_logo_image(png_bytes, "image/png", max_dimension=800, quality=85)

    assert opt_type == "image/webp"
    assert ext == "webp"
    assert len(opt_bytes) < len(png_bytes)

    # Verify decoded dimensions
    res_img = Image.open(io.BytesIO(opt_bytes))
    assert res_img.size[0] == 800
    assert res_img.size[1] == 600


def test_optimize_jpeg_to_webp():
    img = Image.new("RGB", (600, 400), (10, 80, 150))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    jpg_bytes = buf.getvalue()

    opt_bytes, opt_type, ext = optimize_logo_image(jpg_bytes, "image/jpeg", max_dimension=800, quality=85)

    assert opt_type == "image/webp"
    assert ext == "webp"


def test_fallback_on_corrupt_data():
    corrupt = b"not-a-valid-image-data-stream"
    opt_bytes, opt_type, ext = optimize_logo_image(corrupt, "image/png")
    assert opt_bytes == corrupt

