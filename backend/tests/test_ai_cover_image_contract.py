import json
from unittest.mock import patch

from services import ai_cover_image


class _FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return json.dumps({
            "data": [{"b64_json": "ZmFrZS1wbmc="}],
            "model": "gpt-image-2",
            "quality": "high",
        }).encode("utf-8")


def test_generate_cover_image_uses_stable_image_contract(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("OPENAI_AI_IMAGE_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_AI_IMAGE_TIMEOUT_SECONDS", raising=False)
    monkeypatch.setenv("OPENAI_AI_IMAGE_QUALITY", "high")
    captured = {}

    def fake_urlopen(request, timeout):
        captured["timeout"] = timeout
        captured["body"] = json.loads(request.data.decode("utf-8"))
        return _FakeResponse()

    with patch("services.ai_cover_image.urllib.request.urlopen", side_effect=fake_urlopen):
        result = ai_cover_image.generate_cover_image({
            "trim_width_mm": 210,
            "trim_height_mm": 297,
            "spine_mm": 10,
            "bleed_mm": 3,
            "style_request": "premium public report cover",
            "theme_context": "education and community",
            "preset_name": "공공기관·교육청",
        }, uid="user-1")

    body = captured["body"]
    assert captured["timeout"] == 180
    assert body["model"] == "gpt-image-2"
    assert body["quality"] == "medium"
    assert body["background"] == "opaque"
    assert body["output_format"] == "png"
    assert body["moderation"] == "auto"
    assert body["n"] == 1
    width, height = map(int, body["size"].split("x"))
    assert width % 16 == 0 and height % 16 == 0
    assert max(width, height) <= ai_cover_image.STABLE_MAX_EDGE
    assert 655_360 <= width * height <= ai_cover_image.STABLE_MAX_PIXELS
    assert max(width, height) / min(width, height) <= 3
    assert result["model"] == "gpt-image-2"
    assert result["image_base64"] == "ZmFrZS1wbmc="
    assert result["prompt_version"] == "cover-background-v6-clean-report-front-mode"


def test_timeout_env_is_clamped(monkeypatch):
    monkeypatch.setenv("OPENAI_AI_IMAGE_TIMEOUT_SECONDS", "999")
    assert ai_cover_image._image_timeout_seconds() == 300
    monkeypatch.setenv("OPENAI_AI_IMAGE_TIMEOUT_SECONDS", "30")
    assert ai_cover_image._image_timeout_seconds() == 60


def test_front_cover_mode_uses_single_cover_geometry():
    req = ai_cover_image.normalize_cover_request({
        "cover_mode": "front",
        "trim_width_mm": 210,
        "trim_height_mm": 297,
        "spine_mm": 20,
        "wing_mm": 70,
        "bleed_mm": 3,
        "style_request": "clean annual report",
    })
    assert req.cover_mode == "front"
    assert req.spine_mm == 0
    assert req.wing_mm == 0
    assert req.work_width_mm == 216
    assert req.work_height_mm == 303
    prompt = ai_cover_image.build_cover_prompt(req)
    assert "FRONT COVER ONLY" in prompt
    assert "Do not invent a back cover, spine" in prompt


def test_default_ai_cover_quality_is_medium_and_high_env_is_capped(monkeypatch):
    assert ai_cover_image.DEFAULT_IMAGE_QUALITY == "medium"
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_AI_IMAGE_QUALITY", "high")
    captured = {}

    def fake_urlopen(request, timeout):
        captured["body"] = json.loads(request.data.decode("utf-8"))
        return _FakeResponse()

    with patch("services.ai_cover_image.urllib.request.urlopen", side_effect=fake_urlopen):
        ai_cover_image.generate_cover_image({
            "cover_mode": "front",
            "trim_width_mm": 210,
            "trim_height_mm": 297,
            "bleed_mm": 3,
            "style_request": "clean annual report cover",
        }, uid="user-medium")

    assert captured["body"]["quality"] == "medium"
