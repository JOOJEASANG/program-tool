from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PRINT_CHECKER = ROOT / "print-checker" / "index.html"
APP_BOUNDARY = ROOT / "js" / "pdf-editor" / "app-boundary.js"
ROUTE_RUNTIME = ROOT / "js" / "pdf-editor" / "route-runtime.js"
SW_REGISTER = ROOT / "js" / "sw-register.js"
FIREBASE_CONFIG = ROOT / "js" / "firebase-config.js"
ADVANCED_INDEX = ROOT / "pdf-editor-advanced" / "index.html"
ADVANCED_POLISH = ROOT / "js" / "pdf-editor-advanced" / "workspace-input-polish.js"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_print_checker_is_renamed_and_defaults_to_cover():
    page = text(PRINT_CHECKER)
    assert "인쇄물 배치 점검 · Program Studio" in page
    assert '<span class="sb-nav-title">인쇄물 배치 점검</span>' in page
    assert "url.searchParams.set('product', 'cover')" in page


def test_layout_sidebar_removes_requested_control_clusters_and_keeps_collapse_working():
    source = text(APP_BOUNDARY)
    assert "aside.querySelector(':scope>.sub')?.remove()" in source
    assert "pdfUploadOrderQuickBarV1" in source
    assert "pageSelectionToolbar" in source
    assert "연속 추가" in source and "새 묶음 추가" in source
    assert "다중 선택" in source and "페이지 번호" in source
    assert "syncPageSectionState" in source
    assert "event.stopImmediatePropagation()" in source
    assert 'data-file-collapsed="true"' in source


def test_layout_runtime_cache_chain_is_versioned_to_new_boundary():
    route = text(ROUTE_RUNTIME)
    boot = text(SW_REGISTER)
    config = text(FIREBASE_CONFIG)
    assert "app-boundary.js?v=20260909-1" in route
    assert "route-runtime.js?v=20260909-1" in boot
    assert "sw-register.js?v=2026.09.09.001" in config


def test_advanced_editor_accepts_preview_drop_and_preserves_erase_mode():
    page = text(ADVANCED_INDEX)
    source = text(ADVANCED_POLISH)
    assert "workspace-input-polish.js?v=20260909-1" in page
    assert "zone.addEventListener('drop'" in source
    assert "input.dispatchEvent(new Event('change', { bubbles: true }))" in source
    assert "stickyErase" in source
    assert "erase-sticky-page-navigation" in source
    assert "#pageList .page-item,#pairPrevBtn,#pairNextBtn" in source


def test_advanced_auto_align_is_resynchronized_after_upload_busy_state():
    source = text(ADVANCED_POLISH)
    assert "syncAutoAlignAvailability" in source
    assert "button.disabled = !!advancedState.busy || advancedState.pages.length === 0" in source
    assert "MutationObserver(scheduleSync)" in source
    assert "attributeFilter: ['hidden', 'disabled', 'class']" in source
