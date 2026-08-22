from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
THEMES = ROOT / "js" / "design-editor" / "phase21-style-themes.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_style_themes_load_after_print_blocks():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorStyleThemesScriptV1" in source
    assert "/js/design-editor/phase21-style-themes.js?v=20260822-1" in source
    assert source.index("designEditorPrintBlocksScriptV1") < source.index("designEditorStyleThemesScriptV1")


def test_style_themes_are_curated_and_simple():
    source = THEMES.read_text(encoding="utf-8")
    for marker in (
        "clean:{name:'깔끔'",
        "public:{name:'공공기관'",
        "event:{name:'행사홍보'",
        "warm:{name:'따뜻한 감성'",
        "전체 스타일 · 내용은 그대로",
        "글자 내용·위치·사진은 유지",
        "style-theme-grid",
        "style-theme-swatches",
    ):
        assert marker in source


def test_style_theme_preserves_content_and_applies_all_surfaces():
    source = THEMES.read_text(encoding="utf-8")
    assert "(p.surfaces||[]).forEach" in source
    assert "surface.background=theme.bg" in source
    assert "filter(item=>item.type==='text').forEach(item=>applyText(item,theme))" in source
    assert "item.titleStyle=theme.titleStyle" in source
    assert "item.titleAccent=theme.accent" in source
    assert "generatedShape(item)" in source
    assert "smartLayout||item?.componentBlock||item?.printBlock" in source
    assert "item.src=" not in source
    assert ".text=" not in source
    assert ".x=" not in source
    assert ".y=" not in source


def test_style_theme_reuses_existing_quick_design_card_and_scoped_save():
    source = THEMES.read_text(encoding="utf-8")
    assert "designQuickDesignTools" in source
    assert "card.appendChild(panel)" in source
    assert "DesignEditorDraftScope?.saveCurrent?.('style-theme')" in source
    assert "DesignEditorQuickDesign?.sync?.()" in source
    assert "DesignEditorCanvasQuickbar?.sync?.()" in source
    assert "stage:'curated-content-preserving-style-themes'" in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
