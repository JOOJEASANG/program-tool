"""One direct selection surface for the right PDF thumbnail list.

The old range/parity/find menus are visually removed only for the unified
layout; their existing API and standalone booklet/advanced routes are kept.
"""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT/path).read_text(encoding="utf-8")


def test_only_thumbnail_list_has_visible_selection_controls():
    html=read("pdf-editor/index.html")
    selection=read("js/pdf-editor/page-selection-preview-focus.js")
    product=read("js/pdf-editor/page-count-hint.js")
    assert "html.pdf-direct-thumb-selection #pageSidebar #pageSelectionToolbar" in html
    assert "html.pdf-direct-thumb-selection #pageSidebar #pdfPageJumpDetails" in html
    assert "single-selection-ui:not(.selecting):not(.has-history)" in html
    assert "html.pdf-direct-thumb-selection #pageSidebar #thumbArea .pdf-page-select-checkbox{display:block!important}" in html
    assert "document.documentElement.classList.add('pdf-direct-thumb-selection');" in selection
    assert "function ensureListSelectionControls()" in selection
    assert "toggle.id = 'pageListSelectAll';" in selection
    assert "toggle.addEventListener('click', (event) => {" in selection
    assert "event.stopImmediatePropagation();" in selection
    assert "item.tabIndex = 0;" in selection
    assert "panel.classList.toggle('has-history', undoStack.length > 0 || redoStack.length > 0);" in product
    assert "pageListSelectionCount" in selection


def test_individual_thumb_click_and_checkbox_never_toggle_pdf_exclusion():
    selection=read("js/pdf-editor/page-selection-preview-focus.js")
    html=read("pdf-editor/index.html")
    assert "checkbox.addEventListener('click', (event) => {" in selection
    assert "event.stopPropagation();" in selection
    assert "ctrlKey: !event.shiftKey || event.ctrlKey || event.metaKey" in selection
    assert "shiftKey: event.shiftKey" in selection
    assert "selectPage(page, {" in selection
    assert "focusPreviewForPage(pageById(primaryId), true)" in selection
    assert "window.PdfEditorPageSelection" in selection
    assert "getBookletBleedMm" in html  # other PDF modes remain available


def test_batch_actions_and_file_specific_controls_are_preserved():
    select=read("js/pdf-editor/page-selection-preview-focus.js")
    product=read("js/pdf-editor/page-count-hint.js")
    navigation=read("js/pdf-editor/file-navigation.js")
    margin=read("js/pdf-editor/page-selected-margins.js")
    runner=read("scripts/run_pdf_program_shell_smoke.sh")
    browser=read("tests/browser/pdf-page-select-icons-smoke.html")
    for marker in ("selectRange,", "selectParity,", "invertScopeSelection,",
                   "selectFile,", "clearFile,", "selectAll,", "clearSelection,"):
        assert marker in select
    assert "const actionDefinitions = [" in product
    assert "undoStack" in product and "redoStack" in product
    assert "actionRow.appendChild(selectToggle);" in navigation
    assert "panel.hidden=" in margin and "||pages.length===0" in margin
    assert "pdf-page-select-icons-smoke.html" in runner
    assert "for(let id=5;id<=81;id++)" in browser
    assert "81-page select all via page-list heading" in browser
