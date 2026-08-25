from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_cover_preview_cleanup_moves_labels_outside_and_color_codes_zones():
    source = (ROOT / "js" / "design-editor" / "cover-preview-cleanup.js").read_text(encoding="utf-8")

    assert "params.get('embed')!=='1'||params.get('mode')!=='cover'" in source
    assert ".panel-guide-label{display:none!important}" in source
    assert "#designCoverPreviewZones{overflow:visible!important}" in source
    assert ".fold-guide{display:none!important}" in source
    assert "top:-28px!important" in source
    assert "min-width:max-content!important" in source

    assert '.cover-preview-zone[data-zone="back"]{border:1.5px solid #22a06b!important}' in source
    assert '.cover-preview-zone[data-zone="spine"]{border:1.5px solid #e59b23!important' in source
    assert '.cover-preview-zone[data-zone="front"]{border:1.5px solid #2f80ed!important}' in source

    assert '.cover-preview-zone-safe[data-zone="back"]' in source
    assert '.cover-preview-zone-safe[data-zone="spine"]' in source
    assert '.cover-preview-zone-safe[data-zone="front"]' in source
    assert "coverPreviewCleanup='2'" in source


def test_cover_preview_cleanup_is_loaded_for_design_editor_routes():
    source = (ROOT / "js" / "app-version.js").read_text(encoding="utf-8")

    assert "designCoverPreviewCleanupScriptV1" in source
    assert "/js/design-editor/cover-preview-cleanup.js?v=20260825-1" in source
    assert "currentPath==='/design-editor/general'" in source
