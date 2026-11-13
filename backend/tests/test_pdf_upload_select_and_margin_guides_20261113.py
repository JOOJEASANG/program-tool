"""Regression: selection is ready on initial import; guides never reach PDF bytes."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT/path).read_text(encoding="utf-8")


def test_uploaded_thumbnails_get_checkboxes_without_select_all_warmup():
    source=read("js/pdf-editor/page-selection-preview-focus.js")
    browser=read("tests/browser/pdf-page-select-icons-smoke.html")
    assert "function installThumbImportSync()" in source
    assert "thumbImportObserver.observe(area, { childList: true });" in source
    assert "item.querySelector('.thumb-wrap .pdf-page-select-checkbox')" in source
    assert "queueMicrotask(() => { ensureToolbar(); syncSelectionUi(); });" in source
    assert "window.rawUploadRenderThumbs();" in browser
    assert "fresh upload did not initialize checkboxes before select-all" in browser
    assert "freshly imported checkbox works before any select-all action" in browser


def test_sheet_and_margin_guides_are_screen_only_and_use_real_mm():
    guide=read("js/pdf-editor/preview-margin-guides.js")
    html=read("pdf-editor/index.html")
    route=read("js/pdf-editor/route-runtime.js")
    browser=read("tests/browser/pdf-preview-margin-guides-smoke.html")
    runner=read("scripts/run_pdf_program_shell_smoke.sh")
    assert "preview-margin-guides.js?v=20261113-1" in route
    assert 'id="previewGuidesToggle"' in html
    assert "wrap.dataset.previewPaperWidthMm" in html
    assert "canvas.dataset['margin'+edge+'Mm']" in html
    assert "#previewScroll .page-preview.pdf-paper-guides::after" in guide
    assert "dashed #d97706" in guide
    assert "attr(data-paper-mm)" in guide
    assert "layoutMargins?.(index)" in guide
    assert "page-preview.pdf-paper-guides::before" in guide
    assert "@media print" in guide
    assert "context.getImageData" not in guide
    assert "ctx.drawImage" not in guide
    assert "guide was drawn into the PDF canvas" in browser
    assert "lazy preview replacement lost guides" in browser
    assert "pdf-preview-margin-guides-smoke.html" in runner


def test_guides_and_page_selection_preserve_server_pdf_generation_contract():
    guide=read("js/pdf-editor/preview-margin-guides.js")
    selection=read("js/pdf-editor/page-selection-preview-focus.js")
    assert "window.PdfPreviewMarginGuides={install" in guide
    assert "previewGuidesToggle" in guide
    assert "document.addEventListener('pdf-import-committed'" in guide
    assert "installThumbImportSync();" in selection
    assert "selectedIds" in selection
    assert '"version": "2026.11.13.001"' in read("version.json")
