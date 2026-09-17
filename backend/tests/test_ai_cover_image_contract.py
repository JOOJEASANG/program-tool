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
    assert body["quality"] == "high"
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
    assert result["prompt_version"] == "cover-background-v3-stable-image2"


def test_timeout_env_is_clamped(monkeypatch):
    monkeypatch.setenv("OPENAI_AI_IMAGE_TIMEOUT_SECONDS", "999")
    assert ai_cover_image._image_timeout_seconds() == 300
    monkeypatch.setenv("OPENAI_AI_IMAGE_TIMEOUT_SECONDS", "30")
    assert ai_cover_image._image_timeout_seconds() == 60
