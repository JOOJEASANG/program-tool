from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
PRODUCTIVITY = ROOT / "js" / "pdf-editor" / "page-count-hint.js"
EDITOR = ROOT / "pdf-editor" / "index.html"
LEGACY = ROOT / "tools" / "pdf-editor.html"


def source() -> str:
    return PRODUCTIVITY.read_text(encoding="utf-8")


def test_productivity_is_integrated_without_adding_runtime_modules():
    loader = LOADER.read_text(encoding="utf-8")
    text = source()
    assert "__pdfEditorPageProductivityV3" in text
    assert "/js/pdf-editor/page-count-hint.js" in loader
    assert "/js/pdf-editor/page-productivity.js" not in loader
    assert "/js/pdf-editor/page-selection-preview-focus.js" not in loader
    assert loader.count("'/js/pdf-editor/") == 8
    assert EDITOR.read_bytes() == LEGACY.read_bytes()


def test_explicit_checkbox_selection_does_not_replace_thumbnail_navigation():
    text = source()
    assert "pageSelectionModeBtnV3" in text
    assert "page-select-check" in text
    assert "item.appendChild(checkbox)" in text
    assert "toggleSelectedPage(rawId, checkbox.checked, event.shiftKey)" in text
    assert "일반 클릭 미리보기 이동은 유지" in text
    assert "event.stopImmediatePropagation" not in text


def test_thumbnail_string_ids_are_normalized_to_editor_page_ids():
    text = source()
    assert "String(page.id) === String(id)" in text
    assert "function canonicalPageId(id)" in text
    assert "const canonicalId = parsedPages[index].id" in text
    assert "const id = canonicalPageId(rawId)" in text
    assert "selectedIds.has(id)" in text


def test_batch_actions_are_available_for_selected_pages():
    text = source()
    for marker in (
        "rotateSelected(-90)",
        "rotateSelected(90)",
        "setSelectedHidden(true)",
        "setSelectedHidden(false)",
        "duplicateSelected",
        "moveSelected(true)",
        "moveSelected(false)",
        "deleteSelected",
    ):
        assert marker in text
    assert "선택 페이지 맨 앞으로 이동" in text
    assert "선택 페이지 맨 뒤로 이동" in text


def test_undo_redo_uses_bounded_reference_snapshots():
    text = source()
    assert "HISTORY_LIMIT = 30" in text
    assert "const undoStack = []" in text
    assert "const redoStack = []" in text
    assert "captureSnapshot" in text
    assert "restoreSnapshot" in text
    assert "undoStack.shift()" in text
    assert "page," in text
    assert "thumbCanvas" not in text.split("function captureSnapshot", 1)[1].split("function restoreSnapshot", 1)[0]


def test_keyboard_shortcuts_and_page_jump_are_available():
    text = source()
    assert "pageUndoBtnV3" in text
    assert "pageRedoBtnV3" in text
    assert "pageJumpInputV3" in text
    assert "event.key.toLowerCase()" in text
    assert "key === 'y'" in text
    assert "event.shiftKey" in text
    assert "jumpToOrdinal" in text
    assert "scrollIntoView" in text
    assert "new MouseEvent('click'" in text
    assert "parsedPages[ordinal - 1]" in text


def test_history_is_cleared_when_source_file_objects_change():
    text = source()
    assert "const fileIdentityMap = new WeakMap()" in text
    assert "function fileIdentity(file)" in text
    assert "fileIdentity(file)" in text
    assert "signature !== lastFileSignature" in text
    assert "undoStack.length = 0" in text
    assert "redoStack.length = 0" in text


def test_productivity_uses_observers_without_render_function_wrapping():
    text = source()
    assert "new MutationObserver" in text
    assert "requestAnimationFrame(decorateThumbnails)" in text
    assert "const original = renderThumbs" not in text
    assert "const original = displayPreview" not in text
    assert "renderThumbs = wrapped" not in text
    assert "displayPreview = wrapped" not in text


def test_productivity_module_has_no_eval_or_unbounded_polling():
    text = source()
    assert "eval(" not in text
    assert "setInterval(" not in text
