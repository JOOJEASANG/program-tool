from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PREVIEW_HELPER = ROOT / "js" / "pdf-editor" / "preview-row-default.js"
UPLOAD_FIX = ROOT / "js" / "pdf-editor" / "upload-fix.js"
CORE_RUNTIME = ROOT / "js" / "pdf-editor" / "core-runtime.js"


def test_fast_mode_keeps_blank_and_divider_insert_actions_visible():
    source = PREVIEW_HELPER.read_text(encoding="utf-8")

    for marker in (
        "function ensureFastInsertActions()",
        "window.__pdfEditorFastMode",
        "pdfFastInsertActionsV1",
        "pdf-fast-insert-actions",
        "blank.textContent = '+ 빈 페이지'",
        "divider.textContent = '+ 간지'",
        "새 항목은 문서 끝에 추가됩니다.",
        "new MutationObserver(() => ensureFastInsertActions())",
    ):
        assert marker in source


def test_fast_mode_blank_insert_updates_existing_page_model_without_heavy_preview():
    source = PREVIEW_HELPER.read_text(encoding="utf-8")

    assert "parsedPages.splice(parsedPages.length, 0, makeBlankPage())" in source
    assert "if (typeof renderThumbs === 'function') renderThumbs()" in source
    assert "window.PdfUploadOptimization?.syncAggregateMode?.()" in source
    assert "refreshFastPreviewPageCount()" in source
    assert "triggerPreview()" not in source


def test_fast_mode_divider_insert_reuses_existing_modal_api():
    source = PREVIEW_HELPER.read_text(encoding="utf-8")

    assert "typeof window.openDividerInsert !== 'function'" in source
    assert "window.openDividerInsert(parsedPages.length)" in source
    assert "dividerModal" not in source


def test_page_list_keeps_a_sticky_append_pdf_action_and_hides_legacy_jump_panel():
    source = PREVIEW_HELPER.read_text(encoding="utf-8")

    for marker in (
        "function ensurePageListQuickAdd()",
        "pdfPageListQuickAddV1",
        "＋ PDF 추가 · 현재 작업에 이어 붙이기",
        "position:sticky",
        "#pdfFileNavigation,#pdfFileNavigationToolbar{display:none!important}",
        "const anchor = document.getElementById('pageProductivityPanelV3') || area",
    ):
        assert marker in source


def test_page_list_quick_add_reuses_existing_file_input_and_append_mode():
    source = PREVIEW_HELPER.read_text(encoding="utf-8")

    assert "const mode = hasPages ? 'cont' : 'new'" in source
    assert "_uploadMode = mode" in source
    assert "document.getElementById('fileInput')" in source
    assert "input.click()" in source
    assert "document.getElementById('uploadZone')?.click()" in source


def test_large_document_optimization_still_stays_enabled():
    source = UPLOAD_FIX.read_text(encoding="utf-8")

    assert "const OPTIMIZED_PAGE_LIMIT = 120" in source
    assert "const OPTIMIZED_BYTE_LIMIT = 160 * 1024 * 1024" in source
    assert "showFastModePlaceholder(mode.pages, mode.bytes)" in source
    assert "setFastMode(optimized" in source


def test_pdf_core_runtime_module_count_is_unchanged():
    source = CORE_RUNTIME.read_text(encoding="utf-8")

    assert source.count("src:'/js/pdf-editor/") == 8
    assert "preview-row-default.js?v=20260831-1" in source
    assert "divider-helper.js" in source
