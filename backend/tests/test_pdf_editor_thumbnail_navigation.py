from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
EDITOR = ROOT / "pdf-editor" / "index.html"
LEGACY = ROOT / "tools" / "pdf-editor.html"


def test_thumbnail_click_is_captured_for_preview_navigation():
    source = LOADER.read_text(encoding="utf-8")
    assert "installThumbnailPageBehavior" in source
    assert "event.stopImmediatePropagation();" in source
    assert "focusPageInPreview(page).catch" in source
    assert "target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });" in source
    assert "숨김 페이지입니다. 마우스 오른쪽 메뉴에서 숨김 해제를 선택하세요." in source


def test_context_menu_contains_explicit_hide_and_unhide_action():
    source = LOADER.read_text(encoding="utf-8")
    assert "togglePageHiddenFromContextMenu" in source
    assert "page.excluded ? '페이지 숨김 해제' : '페이지 숨기기'" in source
    assert "data-page-hidden-action" in source or "pageHiddenAction" in source
    assert "schedulePreview(80)" in source


def test_navigation_maps_source_pages_to_nup_and_booklet_outputs():
    source = LOADER.read_text(encoding="utf-8")
    assert "getPreviewLocationForPage" in source
    assert "bookletReorderPreview(active, nup)" in source
    assert "groupByNup(ordered)" in source
    assert "outputGroups.findIndex(group => group.includes(page))" in source


def test_stable_editor_surface_and_module_count_are_unchanged():
    source = LOADER.read_text(encoding="utf-8")
    assert EDITOR.read_bytes() == LEGACY.read_bytes()
    assert source.count("'/js/pdf-editor/") == 8
    assert "__pdfEditorModuleLoaderV16" in source
