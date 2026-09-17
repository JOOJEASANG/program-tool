import pytest

from services import ai_print_design as service


def test_cover_background_uses_landscape_generation_size():
    assert service._image_size(176, 248, "cover", 8) == "1536x1024"


def test_poster_background_uses_portrait_generation_size():
    assert service._image_size(210, 297, "poster", 0) == "1024x1536"


def test_layout_instructions_keep_text_as_editable_layers():
    prompt = service._layout_instructions({
        "document_type": "poster",
        "width_mm": 210,
        "height_mm": 297,
        "bleed_mm": 3,
        "safe_mm": 10,
        "style_prompt": "밝고 전문적인 행사 포스터",
        "fields": {"title": "테스트 행사", "date": "2026-09-17"},
    })
    assert "사용자가 입력한 원문" in prompt
    assert "글자" in prompt
    assert "절대로" in prompt
    assert "테스트 행사" in prompt


def test_api_key_is_required_only_on_server(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(service.OpenAIServiceError) as error:
        service._api_key()
    assert error.value.status_code == 503
