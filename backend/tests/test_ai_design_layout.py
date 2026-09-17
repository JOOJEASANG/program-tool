from services.ai_design_layout import AiDesignError, normalize_request, sanitize_layout


def test_normalize_cover_geometry_and_copy():
    request = normalize_request({
        "document_type": "cover",
        "trim_width_mm": 176,
        "trim_height_mm": 248,
        "spine_mm": 8.4,
        "bleed_mm": 3,
        "fields": {"title": "운영사례집", "subtitle": "학교와 마을"},
        "has_logo": True,
        "style_request": "밝고 정돈된 공공기관 보고서",
    })
    assert request.document_type == "cover"
    assert request.trim_width_mm == 176
    assert request.trim_height_mm == 248
    assert request.spine_mm == 8.4
    assert request.bleed_mm == 3
    assert request.fields["title"] == "운영사례집"
    assert request.has_logo is True


def test_normalize_requires_title():
    try:
        normalize_request({"document_type": "poster", "fields": {"venue": "천안"}})
    except AiDesignError as exc:
        assert exc.status_code == 400
        assert exc.code == "AI_DESIGN_TITLE_REQUIRED"
    else:
        raise AssertionError("title-less request should fail")


def test_sanitize_layout_keeps_only_supplied_editable_elements():
    request = normalize_request({
        "document_type": "cover",
        "trim_width_mm": 176,
        "trim_height_mm": 248,
        "spine_mm": 9,
        "bleed_mm": 3,
        "fields": {"title": "제목", "date": "2026.09.17"},
        "has_logo": True,
    })
    result = sanitize_layout({
        "background": {
            "base_color": "#ffffff",
            "accent_colors": ["#123456", "bad"],
            "shapes": [{
                "kind": "circle", "x": 105, "y": -5, "w": 40, "h": 40,
                "rotation": 0, "color": "#abcdef", "opacity": 0.2,
            }],
        },
        "elements": [
            {"id": "title", "zone": "front", "x": 10, "y": 10, "w": 70, "h": 15, "font_size_pt": 32, "font_weight": 800, "align": "left", "color": "#101010", "rotate": 0},
            {"id": "subtitle", "zone": "front", "x": 10, "y": 30, "w": 70, "h": 10, "font_size_pt": 14, "font_weight": 500, "align": "left", "color": "#202020", "rotate": 0},
            {"id": "logo", "zone": "front", "x": 70, "y": 85, "w": 20, "h": 8, "font_size_pt": 10, "font_weight": 400, "align": "right", "color": "#000000", "rotate": 0},
        ],
        "style_note": "정돈된 표지",
    }, request)

    ids = {item["id"] for item in result["elements"]}
    assert "title" in ids
    assert "date" in ids  # omitted by model -> deterministic editable fallback
    assert "logo" in ids
    assert "spine_title" in ids or request.spine_mm >= 4
    assert "subtitle" not in ids
    assert result["background"]["base_color"] == "#FFFFFF"
    assert result["background"]["accent_colors"][1] == "#1F4E79"
