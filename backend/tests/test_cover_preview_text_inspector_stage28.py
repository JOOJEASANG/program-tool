from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "cover-preview-text-inspector.js"
APP_VERSION = ROOT / "js" / "app-version.js"
SURFACE = ROOT / "js" / "cover-template-surface-cleanup.js"
TEMPLATE_MANAGER = ROOT / "js" / "cover-template-manager.js"


def test_preview_text_inspector_is_loaded_on_cover_page():
    app = APP_VERSION.read_text(encoding="utf-8")
    surface = SURFACE.read_text(encoding="utf-8")
    assert "/js/cover-preview-text-inspector.js?v=20260818-1" in app
    assert "/js/cover-preview-text-inspector.js?v=20260818-1" in surface


def test_preview_text_inspector_offers_simple_direct_controls():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "coverPreviewTextInput",
        "coverPreviewFont",
        "coverPreviewSize",
        "coverPreviewSizeDown",
        "coverPreviewSizeUp",
        "coverPreviewBold",
        "coverPreviewColor",
        "data-cover-preview-align=\"left\"",
        "data-cover-preview-align=\"center\"",
        "data-cover-preview-align=\"right\"",
        "coverPreviewSpineDirection",
        "아래→위",
        "세로쓰기",
        "위→아래",
    ):
        assert marker in source


def test_preview_text_inspector_keeps_existing_move_resize_and_snap_controls():
    source = MODULE.read_text(encoding="utf-8")
    canvas = (ROOT / "js" / "cover-text-canvas-controls.js").read_text(encoding="utf-8")
    assert "window.CoverTextCanvasControls" in source
    assert "controls.install?.()" in source
    assert "data-cover-text-handle" in canvas
    assert "coverTextSnapToggle" in canvas
    assert "snapLayout" in canvas
    assert "data-align-axis=\"x\"" in canvas
    assert "data-align-axis=\"y\"" in canvas


def test_preview_text_renderer_supports_font_alignment_and_per_spine_direction():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "FONT_STACKS",
        "Pretendard",
        "Malgun Gothic",
        "Batang",
        "Gulim",
        "entry.fontKey",
        "entry.align",
        "entry.direction",
        "drawFrontBack",
        "drawSpine",
        "wrapText",
        "window.renderCover = wrapped",
    ):
        assert marker in source
    assert "eval(" not in source
    assert "setInterval(" not in source


def test_preview_text_edits_participate_in_history_and_persist_locally():
    source = MODULE.read_text(encoding="utf-8")
    history = (ROOT / "js" / "cover-edit-history.js").read_text(encoding="utf-8")
    assert "api()?.save?.()" in source
    assert "cover-editor-change-committed" in source
    assert "#coverTextContextToolbar" in history
    assert "cover-editor-change-committed" in history


def test_template_sidebar_no_longer_builds_any_template_ui():
    source = TEMPLATE_MANAGER.read_text(encoding="utf-8")
    assert "removeTemplateUi" in source
    assert "template-ui-retired" in source
    assert "createElement('section')" not in source
    assert "localStorage" not in source
    assert "firebase.storage" not in source
