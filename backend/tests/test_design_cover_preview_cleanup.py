from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_cover_preview_uses_color_coded_dashed_guides_and_shows_dimensions():
    source = (ROOT / "js" / "design-editor" / "cover-preview-cleanup.js").read_text(encoding="utf-8")

    assert "params.get('embed')!=='1'||params.get('mode')!=='cover'" in source
    assert ".panel-guide-label{display:none!important}" in source
    assert "#designCoverPreviewZones{overflow:visible!important}" in source
    assert ".fold-guide{display:none!important}" in source

    assert "outline:1.5px dashed #2563eb!important" in source
    assert "border:1.5px dashed #dc2626!important" in source
    assert "border-right:1.5px dashed #f59e0b!important" in source
    assert "border:1.2px dashed #16a34a!important" in source
    assert "rgba(124,58,237,.10)" in source

    assert "표지 펼침 ${mm(spread)} × ${mm(trimH)} mm" in source
    assert "앞/뒤 ${mm(trimW)} × ${mm(trimH)} mm" in source
    assert "책등 ${mm(spine)} mm" in source
    assert "재단여백 ${mm(bleed)} mm" in source
    assert "안전여백 ${mm(safe)} mm" in source
    assert "coverPreviewCleanup='4'" in source


def test_cover_preview_cleanup_is_loaded_with_fresh_asset_key():
    source = (ROOT / "js" / "app-version.js").read_text(encoding="utf-8")

    assert "designCoverPreviewCleanupScriptV1" in source
    assert "/js/design-editor/cover-preview-cleanup.js?v=20260825-3" in source
    assert "currentPath==='/design-editor/general'" in source
