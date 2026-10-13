"""Batch context menu dispatch and behavioral regressions for checked PDF pages."""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRODUCTIVITY = ROOT / "js" / "pdf-editor" / "page-count-hint.js"
INDEX = ROOT / "pdf-editor" / "index.html"
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_pdf_editor_batch_context_behavior.cjs"


def test_context_menu_dispatches_checked_page_ids_to_one_batch_action():
    source = INDEX.read_text(encoding="utf-8")
    assert "contextSelectionIdsForPage?.(page)" in source
    assert "menu.dataset.batchSelectionIds" in source
    assert "runContextAction?.(action, batchIds, degrees)" in source
    assert "선택한 ${batchIds.length}페이지에 일괄 적용" in source
    for action in ("'rotate'", "'insertBefore'", "'insertAfter'", "'delete'"):
        assert action in source
    assert "if (isBatch)" in source
    assert "rotateAndRefresh(page, 90)" in source  # unchanged single-page fallback
    assert "rotateAllAndRefresh(90)" in source  # unchanged global action


def test_hide_menu_uses_frozen_checkbox_group_and_original_fallback():
    source = LOADER.read_text(encoding="utf-8")
    assert "JSON.parse(menu.dataset.batchSelectionIds || '[]')" in source
    assert "PdfPageProductivity.runContextAction(page.excluded ? 'show' : 'hide', batchIds)" in source
    assert "togglePageHiddenFromContextMenu(page)" in source


def test_batch_actions_use_atomic_undo_and_one_blank_per_selected_page():
    source = PRODUCTIVITY.read_text(encoding="utf-8")
    assert "function contextSelectionIdsForPage(page)" in source
    assert "selectedIds.has(page.id)" in source
    assert "async function runContextAction(action, ids, delta = 0)" in source
    assert "commitBatchAction(label, async () => {" in source
    assert "parsedPages = parsedPages.flatMap((page) => {" in source
    assert "targets.forEach((page) => selectedIds.delete(page.id))" in source


def test_batch_right_click_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)], cwd=ROOT, text=True, capture_output=True, check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf-editor batch right-click behavior passed" in result.stdout
