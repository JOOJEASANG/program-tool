from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_divider_studio_supports_two_line_title_and_auto_wrap():
    source = (ROOT / "js" / "pdf-editor" / "divider-studio.js").read_text(encoding="utf-8")

    assert "MAX_TITLE_LENGTH = 240" in source
    assert "textarea.id = 'dividerTitle'" in source
    assert "textarea.rows = 2" in source
    assert "if (event.key === 'Enter' && textarea.value.includes('\\n'))" in source
    assert "function wrapTwoLines" in source
    assert "drawBaseText(ctx,source.title" in source
    assert "'700',true" in source


def test_divider_studio_has_shape_layers_for_title_box_design():
    source = (ROOT / "js" / "pdf-editor" / "divider-studio.js").read_text(encoding="utf-8")

    assert "MAX_SHAPES = 24" in source
    assert "data-add-shape=\"titleBox\"" in source
    assert "data-add-shape=\"roundRect\"" in source
    assert "data-add-shape=\"line\"" in source
    assert "data-add-shape=\"circle\"" in source
    assert "content.shapeLayers=collectShapes()" in source
    assert "source.shapeLayers" in source
    assert "function drawShape" in source


def test_divider_studio_has_multiple_background_and_base_styles():
    source = (ROOT / "js" / "pdf-editor" / "divider-studio.js").read_text(encoding="utf-8")

    for background in ("solid", "gradient", "soft", "diagonal", "grid", "spotlight"):
        assert f'data-bg-style=\"{background}\"' in source
    for style in ("frame", "corner", "modern"):
        assert f"['{style}'" in source or f"data-style=\"{style}\"" in source
    assert "content.bg2" in source
    assert "content.bgStyle=activeBgStyle()" in source
    assert "divider-studio-v3-layers-background-multiline" in source
