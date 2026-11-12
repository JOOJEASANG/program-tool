"""Prevent page-selection regression from legacy sidebar and virtualized preview.

Regression: clicking a page in the deployed right sidebar could navigate the
large-document preview before the selection listener ran, while number-only CSS
hid checkboxes/canvases and PDF HTML explicitly hid the selection checkmark.
"""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT/path).read_text(encoding="utf-8")


def test_main_page_selection_has_visible_checkbox_and_blue_badge():
    page=read("pdf-editor/index.html")
    select=read("js/pdf-editor/page-selection-preview-focus.js")
    assert "html.pdf-direct-thumb-selection #pageSidebar #thumbArea .pdf-page-select-checkbox" in page
    assert "html.pdf-direct-thumb-selection #pageSidebar #thumbArea .thumb-item.page-selected .page-selection-mark" in page
    assert ".thumb-item[data-batch-selected=\"true\"]::after{display:none!important}" in page
    assert "#pageSidebar #thumbArea .page-selection-mark,\n" not in page
    assert "item.classList.toggle('page-selected', selected)" in select
    assert "checkbox.checked = selected;" in select
    assert "selectPage(page, {" in select
    assert "ctrlKey: !event.shiftKey || event.ctrlKey || event.metaKey" in select


def test_number_only_sidebar_is_disabled_for_direct_selection_without_breaking_other_profiles():
    polish=read("js/pdf-editor/editor-interaction-polish.js")
    assert "html:not(.pdf-direct-thumb-selection) body[data-program-kind=\"pdf-editor\"]" in polish
    assert "if(document.documentElement.classList.contains('pdf-direct-thumb-selection')){" in polish
    assert "delete area.dataset.numberOnlyNavigation" in polish
    assert "item.draggable=true;" in polish
    assert "if(document.documentElement.classList.contains('pdf-direct-thumb-selection'))return;" in polish


def test_lazy_preview_never_preempts_selection_and_virtualized_navigation_remains():
    lazy=read("js/pdf-editor/viewport-lazy-preview.js")
    select=read("js/pdf-editor/page-selection-preview-focus.js")
    assert "if (document.documentElement.classList.contains('pdf-direct-thumb-selection')" in lazy
    assert "&& window.PdfEditorPageSelection?.selectedIds) return;" in lazy
    assert "selectSourcePage: markSelectedThumbnail" in lazy
    assert "const descriptors = lazy.buildOutputDescriptors?.() || [];" in select
    assert "lazy.descriptorIndexForPage(page, descriptors)" in select
    assert "lazy.selectSourcePage?.(page)" in select
    assert "void lazy.navigateOutput(output)" in select


def test_browser_renders_conflicting_modules_and_checks_81th_page_selection():
    test=read("tests/browser/pdf-page-select-icons-smoke.html")
    runner=read("scripts/run_pdf_program_shell_smoke.sh")
    assert "editor-interaction-polish.js?v=20261112-1" in test
    assert "viewport-lazy-preview.js?v=20261112-5" in test
    assert "window.__pdfEditorFastMode=true;" in test
    assert "legacy CSS still hides real source thumbnail canvases" in test
    assert "selected-page check badge is not visible" in test
    assert "81-page lazy navigation click reselects page" in test
    assert "pdf-page-select-icons-smoke.html" in runner
