import pytest

from services.ai_cover_image import (
    AiCoverImageError,
    build_cover_prompt,
    choose_image_size,
    normalize_cover_request,
)


def test_normalize_cover_defaults_to_a4():
    req = normalize_cover_request({"style_request": "premium editorial"})
    assert req.trim_width_mm == 210
    assert req.trim_height_mm == 297
    assert req.spine_mm == 0
    assert req.bleed_mm == 3


def test_choose_image_size_is_valid_multiple_of_16():
    req = normalize_cover_request({
        "trim_width_mm": 210,
        "trim_height_mm": 297,
        "spine_mm": 8,
        "bleed_mm": 3,
        "style_request": "clean public report",
    })
    width, height = map(int, choose_image_size(req).split("x"))
    assert width % 16 == 0
    assert height % 16 == 0
    assert 1024 <= width <= 3072
    assert 1024 <= height <= 3072
    assert (1 / 3) <= width / height <= 3


def test_prompt_is_background_only_and_spine_aware():
    req = normalize_cover_request({
        "trim_width_mm": 176,
        "trim_height_mm": 248,
        "spine_mm": 12,
        "bleed_mm": 3,
        "style_request": "minimal premium education report",
        "theme_context": "education, community, collaboration",
        "preset_name": "공공기관·교육청",
    })
    prompt = build_cover_prompt(req)
    assert "BACKGROUND ARTWORK ONLY" in prompt
    assert "Do not draw any words" in prompt
    assert "spine" in prompt.lower()
    assert "12.00 mm" in prompt
    assert "front cover" in prompt.lower()
    assert "back cover" in prompt.lower()


def test_style_request_is_required():
    with pytest.raises(AiCoverImageError) as exc_info:
        normalize_cover_request({})
    assert exc_info.value.code == "AI_COVER_STYLE_REQUIRED"


def test_extreme_cover_ratio_is_rejected():
    with pytest.raises(AiCoverImageError) as exc_info:
        normalize_cover_request({
            "trim_width_mm": 50,
            "trim_height_mm": 1000,
            "spine_mm": 0,
            "bleed_mm": 0,
            "style_request": "minimal",
        })
    assert exc_info.value.code == "AI_COVER_RATIO_UNSUPPORTED"
