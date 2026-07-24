from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
PRODUCTIVITY = ROOT / "js" / "pdf-editor" / "page-productivity.js"


def test_page_productivity_module_loads_after_selection_module():
    loader = LOADER.read_text(encoding="utf-8")
    assert "/js/pdf-editor/page-productivity.js" in loader
    assert loader.rfind("page-productivity.js") > loader.rfind("page-selection-preview-focus.js")
    assert loader.rfind("page-productivity.js") < loader.rfind("booklet-reliability.js")


def test_undo_redo_uses_bounded_reference_snapshots():
    text = PRODUCTIVITY.read_text(encoding="utf-8")
    assert "HISTORY_LIMIT = 30" in text
    assert "const undoStack = []" in text
    assert "const redoStack = []" in text
    assert "captureSnapshot" in text
    assert "restoreSnapshot" in text
    assert "undoStack.shift()" in text
    assert "files !== fileSignature()" in text


def test_keyboard_shortcuts_and_toolbar_are_available():
    text = PRODUCTIVITY.read_text(encoding="utf-8")
    assert "pageUndoBtn" in text
    assert "pageRedoBtn" in text
    assert "pageJumpInput" in text
    assert "Ctrl+Z" in text
    assert "event.key.toLowerCase()" in text
    assert "key === 'y'" in text


def test_page_jump_selects_and_focuses_the_requested_thumbnail():
    text = PRODUCTIVITY.read_text(encoding="utf-8")
    assert "jumpToOrdinal" in text
    assert "scrollIntoView" in text
    assert "new MouseEvent('click'" in text
    assert "parsedPages[ordinal - 1]" in text


def test_selected_pages_can_be_duplicated_and_moved_as_a_group():
    text = PRODUCTIVITY.read_text(encoding="utf-8")
    assert "duplicateSelected" in text
    assert "moveSelected" in text
    assert "선택 페이지 복제" in text
    assert "선택 페이지 맨 앞으로 이동" in text
    assert "선택 페이지 맨 뒤로 이동" in text
    assert "parsedPages.splice(insertIndex, 0, ...copies)" in text


def test_productivity_module_has_no_eval_or_unbounded_polling():
    text = PRODUCTIVITY.read_text(encoding="utf-8")
    assert "eval(" not in text
    assert "setInterval(" not in text
