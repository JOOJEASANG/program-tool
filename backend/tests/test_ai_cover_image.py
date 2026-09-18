import json
import urllib.error
from io import BytesIO

import pytest

from services.ai_cover_image import (
    AiCoverImageError,
    DEFAULT_IMAGE_MODEL,
    STABLE_MAX_EDGE,
    STABLE_MAX_PIXELS,
    _allowed_qualities,
    _public_error_from_http,
    build_cover_prompt,
    choose_image_size,
    normalize_cover_request,
)


def test_default_image_model_is_gpt_image_2():
    assert DEFAULT_IMAGE_MODEL == "gpt-image-2"


def test_gpt_image_2_quality_levels_match_official_contract():
    assert _allowed_qualities("gpt-image-2") == {"low", "medium", "high", "auto"}
    assert "xhigh" not in _allowed_qualities("gpt-image-2")
    assert "max" not in _allowed_qualities("gpt-image-2")


def test_normalize_cover_defaults_to_a4():
    req = normalize_cover_request({"style_request": "premium editorial"})
    assert req.trim_width_mm == 210
    assert req.trim_height_mm == 297
    assert req.spine_mm == 0
    assert req.wing_mm == 0
    assert req.bleed_mm == 3


def test_review_wing_width_is_included_in_full_spread_geometry():
    req = normalize_cover_request({
        "trim_width_mm": 176,
        "trim_height_mm": 248,
        "spine_mm": 12,
        "wing_mm": 90,
        "bleed_mm": 3,
        "style_request": "premium editorial",
    })
    assert req.wing_mm == 90
    assert req.work_width_mm == 176 * 2 + 12 + 90 * 2 + 3 * 2
    assert req.work_height_mm == 248 + 3 * 2


def test_choose_image_size_stays_inside_stable_gpt_image_2_range():
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
    assert width <= STABLE_MAX_EDGE
    assert height <= STABLE_MAX_EDGE
    assert 655_360 <= width * height <= STABLE_MAX_PIXELS
    assert max(width, height) / min(width, height) <= 3
    requested_ratio = req.work_width_mm / req.work_height_mm
    rendered_ratio = width / height
    assert abs(rendered_ratio - requested_ratio) / requested_ratio < 0.02


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
    assert "Do not draw readable words" in prompt
    assert "spine" in prompt.lower()
    assert "12.00 mm" in prompt
    assert "front cover" in prompt.lower()
    assert "back cover" in prompt.lower()
    assert "Do not draw a visible center spine strip" in prompt
    assert "editorial illustration, symbolic scenes, iconographic or infographic structures" in prompt
    assert "refined medium saturation" in prompt
    assert "Washed-out low-contrast pastel" in prompt


def test_prompt_is_wing_aware_when_review_option_has_flaps():
    req = normalize_cover_request({
        "trim_width_mm": 176,
        "trim_height_mm": 248,
        "spine_mm": 10,
        "wing_mm": 85,
        "bleed_mm": 3,
        "style_request": "clean editorial cover",
    })
    prompt = build_cover_prompt(req)
    assert "Outer flaps: 85.00 mm" in prompt
    assert "flap zones" in prompt


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


def _http_error(status: int, *, code: str, message: str) -> urllib.error.HTTPError:
    body = json.dumps({"error": {"code": code, "type": "invalid_request_error", "message": message}}).encode("utf-8")
    return urllib.error.HTTPError(
        "https://api.openai.com/v1/images/generations",
        status,
        message,
        {"x-request-id": "req_test_cover"},
        BytesIO(body),
    )


def test_openai_org_verification_error_is_distinct():
    error = _public_error_from_http(_http_error(
        403,
        code="organization_verification_required",
        message="Verify your organization to use this model.",
    ))
    assert error.code == "OPENAI_IMAGE_VERIFICATION_REQUIRED"
    assert error.status_code == 503


def test_openai_model_access_error_is_distinct():
    error = _public_error_from_http(_http_error(
        404,
        code="model_not_found",
        message="You do not have access to model gpt-image-2.",
    ))
    assert error.code == "OPENAI_IMAGE_MODEL_UNAVAILABLE"
    assert error.status_code == 503


def test_openai_moderation_block_is_distinct():
    error = _public_error_from_http(_http_error(
        400,
        code="moderation_blocked",
        message="The request was blocked by moderation.",
    ))
    assert error.code == "OPENAI_IMAGE_MODERATION_BLOCKED"
    assert error.status_code == 400
