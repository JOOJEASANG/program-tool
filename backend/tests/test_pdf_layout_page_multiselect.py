from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTE_RUNTIME = ROOT / "js" / "pdf-editor" / "route-runtime.js"
APP_BOUNDARY = ROOT / "js" / "pdf-editor" / "app-boundary.js"
SELECTION = ROOT / "js" / "pdf-editor" / "page-selection-preview-focus.js"
MANUAL = ROOT / "js" / "program-manuals" / "pdf-editor.js"


def test_layout_route_loads_page_selection_before_generic_thumbnail_navigation():
    route = ROUTE_RUNTIME.read_text(encoding="utf-8")

    selection_path = "/js/pdf-editor/page-selection-preview-focus.js?v=20260914-1"
    loader_path = "/js/pdf-editor/loader.js?v=20260828-1"
    assert "pdfLayoutPageSelectionScriptV1" in route
    assert f"src:'{selection_path}',app:'layout'" in route
    assert route.index(selection_path) < route.index(loader_path)
    assert "if(entry.app&&entry.app!==app)continue;" in route
    assert "window.__pdfEditorHiddenContextActionV1=true;" in route


def test_layout_boundary_keeps_selection_toolbar_visible():
    boundary = APP_BOUNDARY.read_text(encoding="utf-8")

    assert "byId('pageSelectionToolbar')?.remove();" not in boundary
    assert "pdf-layout-booklet-boundary-v4" in boundary


def test_page_selection_supports_partial_range_all_and_batch_context_actions():
    source = SELECTION.read_text(encoding="utf-8")

    for marker in (
        "const selectedIds = new Set();",
        "event.ctrlKey || event.metaKey",
        "event.shiftKey",
        "data-selection-action=\"all\"",
        "data-selection-action=\"clear\"",
        "function selectAll()",
        "function clearSelection()",
        "function rotateSelected(degrees)",
        "function setSelectedExcluded(excluded)",
        "function deleteSelected()",
        "function insertBlank(relative)",
        "선택한 페이지 ${targets.length}개",
        "선택 페이지 숨기기",
        "선택 페이지 다시 포함",
        "선택 시계방향 90° 회전",
        "선택 시계반대방향 90° 회전",
        "선택 180° 회전",
        "선택 페이지 삭제",
    ):
        assert marker in source

    assert source.index("installClickSelection();") < source.index("patchRenderThumbs();")
    assert "event.stopImmediatePropagation();" in source


def test_pdf_editor_manual_documents_multiselect_shortcuts_and_batch_context_menu():
    manual = MANUAL.read_text(encoding="utf-8")

    assert "updated: '2026-09-14'" in manual
    assert "Ctrl/Cmd+클릭" in manual
    assert "Shift+클릭" in manual
    assert "전체선택" in manual
    assert "선택해제" in manual
    assert "선택된 페이지 중 하나를 우클릭" in manual
