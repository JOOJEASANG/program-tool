from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SIDEBAR = ROOT / "js" / "pdf-editor" / "simple-sidebar-ui.js"
INSERT = ROOT / "js" / "pdf-editor" / "preview-insert-persistence.js"


def test_sidebar_removes_print_output_tools_label_even_from_legacy_headers():
    source = SIDEBAR.read_text(encoding="utf-8")

    assert "function removePrintOutputToolLabel()" in source
    assert "const target='인쇄출력도구'" in source
    assert ".ps-tool-panel-head,.ps-tool-rail-title,[data-ps-tool-title]" in source
    assert "ownText(node)" in source
    assert "revision:'print-output-label-cleanup-v6'" in source


def test_preview_insert_buttons_use_document_capture_bridge_after_rerender():
    source = INSERT.read_text(encoding="utf-8")

    assert "document.addEventListener('click',event=>{" in source
    assert "#previewScroll .prev-ins-btn,#previewScroll .prev-ins-btn-v" in source
    assert "event.preventDefault();" in source
    assert "event.stopImmediatePropagation();" in source
    assert "const handled=divider?openDividerAt(index):insertBlankAt(index);" in source
    assert "pdfPreviewInsertActionBridge='document-capture-v2'" in source
    assert "stage:'preview-insert-actions-functional-v5-document-bridge'" in source


def test_blank_insert_mutates_page_list_and_divider_forces_modal_visible():
    source = INSERT.read_text(encoding="utf-8")

    assert "const before=parsedPages.length;" in source
    assert "parsedPages.splice(safe,0,makeBlankPage());" in source
    assert "parsedPages.length!==before+1" in source
    assert "refreshAfterInsert('빈 페이지를 추가했습니다.')" in source
    assert "modal.style.display='flex'" in source
    assert "modal.removeAttribute('hidden')" in source
    assert "document.getElementById('dividerTitle')?.focus?.()" in source


def test_insert_zones_reenable_buttons_after_preview_rerender():
    source = INSERT.read_text(encoding="utf-8")

    assert "function prepareZoneButtons(zone)" in source
    assert "button.type='button'" in source
    assert "button.removeAttribute('disabled')" in source
    assert "button.setAttribute('aria-disabled','false')" in source
    assert "document.querySelectorAll('#previewScroll .prev-ins-zone,#previewScroll .prev-ins-zone-v').forEach(prepareZoneButtons)" in source
