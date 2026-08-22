from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
QUICKBAR = ROOT / "js" / "design-editor" / "phase18-canvas-quickbar.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_canvas_quickbar_loads_after_simple_design_modules():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorCanvasQuickbarScriptV1" in source
    assert "/js/design-editor/phase18-canvas-quickbar.js?v=20260822-1" in source
    assert source.index("designEditorComponentBlocksScriptV1") < source.index("designEditorCanvasQuickbarScriptV1")


def test_canvas_quickbar_is_contextual_for_text_image_and_shape():
    source = QUICKBAR.read_text(encoding="utf-8")
    for marker in (
        ".phase2-extra-object.selected",
        ".design-text.selected",
        "kind:item.type==='image'?'image':'shape'",
        "data-qb-action=\"bold\"",
        "data-qb-align=\"left\"",
        "data-qb-title-style",
        "data-qb-action=\"replace-image\"",
        "data-qb-action=\"fit-image\"",
        "data-qb-action=\"round-shape\"",
        "data-qb-color=\"fill\"",
        "data-qb-layer=\"front\"",
        "data-qb-layer=\"back\"",
    ):
        assert marker in source


def test_canvas_quickbar_reuses_existing_editor_controls_and_scoped_save():
    source = QUICKBAR.read_text(encoding="utf-8")
    for marker in (
        "weightInput",
        "colorInput",
        "data-quick-title-style",
        "phase2ReplaceImage",
        "data-extra-field",
        "quickCornerRadius",
        "DesignEditorDraftScope?.saveCurrent",
        "DesignEditorPhase2?.sync",
        "DesignEditorQuickDesign?.sync",
        "stage:'contextual-canvas-quick-toolbar'",
    ):
        assert marker in source


def test_canvas_quickbar_tracks_selection_without_polling_or_canvas_export_pollution():
    source = QUICKBAR.read_text(encoding="utf-8")
    assert "position:fixed" in source
    assert "artboardViewport" in source
    assert "getBoundingClientRect" in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "appendChild(bar)" in source
    assert "document.body.appendChild(bar)" in source
