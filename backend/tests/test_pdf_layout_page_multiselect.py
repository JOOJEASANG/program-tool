from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTE_RUNTIME = ROOT / "js" / "pdf-editor" / "route-runtime.js"
APP_BOUNDARY = ROOT / "js" / "pdf-editor" / "app-boundary.js"
SELECTION = ROOT / "js" / "pdf-editor" / "page-selection-preview-focus.js"
MANUAL = ROOT / "js" / "program-manuals" / "pdf-editor.js"


def test_layout_route_loads_page_selection_before_generic_thumbnail_navigation():
    route = ROUTE_RUNTIME.read_text(encoding="utf-8")

    selection_path = "/js/pdf-editor/page-selection-preview-focus.js?v=20260914-2"
    loader_path = "/js/pdf-editor/loader.js?v=20260914-4"
    assert "pdfLayoutPageSelectionScriptV1" in route
    assert f"src:'{selection_path}',app:'layout'" in route
    assert route.index(selection_path) < route.index(loader_path)
    assert "if(entry.app&&entry.app!==app)continue;" in route
    assert "window.__pdfEditorHiddenContextActionV1=true;" in route


def test_layout_boundary_keeps_selection_toolbar_visible():
    boundary = APP_BOUNDARY.read_text(encoding="utf-8")

    assert "byId('pageSelectionToolbar')?.remove();" not in boundary
    assert "pdf-layout-booklet-boundary-v4" in boundary


def test_page_selection_freezes_full_context_selection_for_every_batch_action():
    source = SELECTION.read_text(encoding="utf-8")

    for marker in (
        "const selectedIds = new Set();",
        "let contextSelectionIds = [];",
        "function snapshotSelectedIds()",
        "contextSelectionIds = snapshotSelectedIds();",
        "const actionIds = contextIdsForPage(page);",
        "setPagesExcluded(actionIds, true)",
        "setPagesExcluded(actionIds, false)",
        "rotatePages(actionIds, 90)",
        "rotatePages(actionIds, -90)",
        "rotatePages(actionIds, 180)",
        "insertBlankForIds(actionIds, 'before')",
        "insertBlankForIds(actionIds, 'after')",
        "deletePages(actionIds)",
        "menu.dataset.selectionIds = actionIds.join(',')",
        "menu.dataset.selectionCount = String(actionIds.length)",
        "page-selection-batch-snapshot-canvas-v2",
    ):
        assert marker in source

    assert "event.ctrlKey || event.metaKey" in source
    assert "event.shiftKey" in source
    assert "event.stopImmediatePropagation();" in source


def test_sidebar_stays_source_portrait_while_output_rotation_updates_preview_source():
    source = SELECTION.read_text(encoding="utf-8")

    for marker in (
        "#thumbArea{display:flex!important;flex-direction:column!important",
        "aspect-ratio:210/297!important",
        "object-fit:contain!important",
        "function ensureSourceThumb(page)",
        "page.sourceThumbCanvas",
        "canvas.dataset.sidebarSourcePreview = 'true'",
        "page.thumbCanvas = await renderPdfPage(page.pdfPage, 0.9, page.rotation);",
        "refreshRightPreview(options.reason || 'batch-action')",
        "window.PdfViewportLazyPreviewGuard?.refreshRightPreview",
        "pdfSidebarPageView = 'source-portrait'",
    ):
        assert marker in source


def test_pdf_editor_manual_documents_multiselect_shortcuts_and_batch_context_menu():
    manual = MANUAL.read_text(encoding="utf-8")

    assert "updated: '2026-09-14'" in manual
    assert "Ctrl/Cmd+클릭" in manual
    assert "Shift+클릭" in manual
    assert "전체선택" in manual
    assert "선택해제" in manual
    assert "선택된 페이지 중 하나를 우클릭" in manual
