from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_cover_preview_cleanup_removes_duplicate_panel_badges_and_separates_spine_label():
    source = (ROOT / "js" / "design-editor" / "cover-preview-cleanup.js").read_text(encoding="utf-8")

    assert "params.get('embed')!=='1'||params.get('mode')!=='cover'" in source
    assert ".panel-guide-label{display:none!important}" in source
    assert '.cover-preview-zone[data-zone="spine"]' in source
    assert "overflow:visible!important" in source
    assert "top:22px!important" in source
    assert "max-width:none!important" in source
    assert "coverPreviewCleanup='1'" in source


def test_cover_preview_cleanup_is_loaded_for_design_editor_routes():
    source = (ROOT / "js" / "app-version.js").read_text(encoding="utf-8")

    assert "designCoverPreviewCleanupScriptV1" in source
    assert "/js/design-editor/cover-preview-cleanup.js?v=20260825-1" in source
    assert "currentPath==='/design-editor/general'" in source
