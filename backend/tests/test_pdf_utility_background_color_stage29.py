from pathlib import Path

from PIL import Image

from routers.pdf_utility_background import clean_image_background, estimate_background_color


ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend" / "routers" / "pdf_utility.py"


def test_color_background_estimator_detects_yellow_paper():
    image = Image.new("RGB", (160, 120), (255, 244, 155))
    assert estimate_background_color(image) is not None
    detected = estimate_background_color(image)
    assert detected[0] >= 230
    assert detected[1] >= 210
    assert detected[2] <= 190


def test_medium_cleanup_removes_yellow_background_but_keeps_dark_text():
    image = Image.new("RGB", (160, 120), (255, 244, 155))
    for x in range(45, 115):
        for y in range(52, 68):
            image.putpixel((x, y), (35, 35, 35))
    cleaned = clean_image_background(image, "medium")
    background = cleaned.getpixel((5, 5))
    text = cleaned.getpixel((80, 60))
    assert min(background) >= 245
    assert max(text) < 100


def test_medium_cleanup_removes_pink_background():
    image = Image.new("RGB", (160, 120), (255, 185, 205))
    cleaned = clean_image_background(image, "medium")
    background = cleaned.getpixel((5, 5))
    assert min(background) >= 245


def test_router_keeps_background_limits_and_uses_color_aware_hook():
    source = ROUTER.read_text(encoding="utf-8")
    assert "MAX_BACKGROUND_PAGES = 100" in source
    assert "MAX_BACKGROUND_PIXELS = 90_000_000" in source
    assert "BACKGROUND_DPI = 160" in source
