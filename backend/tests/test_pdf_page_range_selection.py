"""PDF배치: range selection is robust for edited-order and source-file scopes."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "js/pdf-editor/page-selection-preview-focus.js"
MANUAL = ROOT / "js/program-manuals/pdf-editor.js"
BEHAVIOR = ROOT / "backend/tests/test_pdf_page_range_selection_behavior.cjs"

def test_range_selection_file_scope_ui_and_drag_mode_keep_sorting_separate():
    source = SOURCE.read_text(encoding="utf-8")
    manual = MANUAL.read_text(encoding="utf-8")
    for marker in (
        "pageSelectionRangeScope",
        "pageSelectionRangeInput",
        "range-replace",
        "range-add",
        "range-remove",
        "data-selection-action=\"odd\"",
        "data-selection-action=\"even\"",
        "data-selection-action=\"invert\"",
        "data-selection-action=\"drag\"",
        "function parseRangeExpression(value, maxPage)",
        "function selectRange(expression, scope = 'all', mode = 'replace')",
        "function selectParity(scope = 'all', parity = 'odd')",
        "function invertScopeSelection(scope = 'all')",
        "item.draggable = !dragSelectMode",
        "function installPointerPaintSelection()",
        "dragSelectPointer = event.pointerId",
        "scope === 'all'",
        "Number(page.page_index) + 1",
    ):
        assert marker in source
    for marker in ("범위 선택", "홀수", "짝수", "드래그 선택", "원본 페이지"):
        assert marker in manual

def test_selection_range_semantics_in_node():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf page range selection behavior passed" in result.stdout
