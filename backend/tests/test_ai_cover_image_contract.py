from services.ai_cover_image import DEFAULT_IMAGE_MODEL, build_cover_prompt, normalize_cover_request


def test_latest_image_model_alias_is_used():
    assert DEFAULT_IMAGE_MODEL == "gpt-image-2.5-sunburst"


def test_cover_prompt_keeps_typography_out_of_generated_background():
    request = normalize_cover_request({
        "trim_width_mm": 210,
        "trim_height_mm": 297,
        "spine_mm": 10,
        "bleed_mm": 3,
        "style_request": "premium editorial report cover",
        "theme_context": "education report",
        "preset_name": "프리미엄 보고서",
    })
    prompt = build_cover_prompt(request)
    assert "BACKGROUND ARTWORK ONLY" in prompt
    assert "Exact Korean text will be added later by the application" in prompt
    assert "spine" in prompt.lower()
