"""PDF배치: 오른쪽 페이지 선택과 파일/페이지 아이콘 메뉴 회귀 검사."""
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[2]
SELECT=ROOT/"js/pdf-editor/page-selection-preview-focus.js"
PRODUCT=ROOT/"js/pdf-editor/page-count-hint.js"
ICONS=ROOT/"js/pdf-editor/page-list-icons.js"
EDITOR=ROOT/"pdf-editor/index.html"
ROUTE=ROOT/"js/pdf-editor/route-runtime.js"
CORE=ROOT/"js/pdf-editor/core-runtime.js"
LOADER=ROOT/"js/pdf-editor/loader.js"
MANUAL=ROOT/"js/program-manuals/pdf-editor.js"
RUNNER=ROOT/"scripts/run_pdf_program_shell_smoke.sh"


def test_layout_selection_and_productivity_share_a_single_set():
    select=SELECT.read_text(encoding="utf-8")
    product=PRODUCT.read_text(encoding="utf-8")
    assert "const selectedIds = new Set();" in select
    assert "window.PdfEditorPageSelection?.selectedIds || new Set()" in product
    assert "window.PdfEditorPageSelection?.selectedIds === selectedIds" in product
    assert "syncSelectionUi," in select
    assert "syncPrimarySelection();" in product
    assert "pdf-page-selection-change" in select and "pdf-page-selection-change" in product
    assert "if (unified) {" in product
    assert "item.querySelector(':scope > .page-select-check')?.remove();" in product
    assert "selectionMode || (unifiedSelection() && selectedIds.size > 0)" in product
    assert "event.target.closest('.thumb-item')" in select
    assert "event.key !== 'Enter' && event.key !== ' '" in select


def test_file_and_page_action_icons_have_labels_and_preserve_existing_actions():
    src=ICONS.read_text(encoding="utf-8")
    for marker in (
        "svg.innerHTML=ICONS[name]||ICONS.square;",
        "button.replaceChildren(icon(shape),caption);",
        "button.setAttribute('aria-label',description);",
        "new MutationObserver(decorateAll).observe(root,{childList:true,subtree:true});",
        "'.pdf-file-delete-btn'",
        "'.pdf-file-select-btn:not(.is-clear)'",
        "'.pdf-file-boundary'",
        "'#pageSelectionModeBtnV3'",
        "'#pageSelectionToolbar [data-selection-action=\"all\"]'",
        "'.page-productivity-actions button[data-batch-action]'",
        "'#pageUndoBtnV3'",
    ):
        assert marker in src
    assert 'src="../js/pdf-editor/page-list-icons.js?v=20261112-1"' in EDITOR.read_text(encoding="utf-8")


def test_versions_and_manual_and_browser_regression():
    assert "page-selection-preview-focus.js?v=20261112-1" in ROUTE.read_text(encoding="utf-8")
    assert "page-count-hint.js?v=20261112-1" in CORE.read_text(encoding="utf-8")
    assert "page-count-hint.js?v=20261112-1" in LOADER.read_text(encoding="utf-8")
    assert "updated: '2026-11-12'" in MANUAL.read_text(encoding="utf-8")
    assert "같은 선택 상태" in MANUAL.read_text(encoding="utf-8")
    assert "pdf-page-select-icons-smoke.html" in RUNNER.read_text(encoding="utf-8")
    for file in (SELECT,PRODUCT,ICONS):
        proc=subprocess.run(["node","--check",str(file)],capture_output=True,text=True,cwd=ROOT)
        assert proc.returncode==0,proc.stdout+proc.stderr
