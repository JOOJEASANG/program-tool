from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PDF_JS = ROOT / "js" / "pdf-editor"


def text(name: str) -> str:
    return (PDF_JS / name).read_text(encoding="utf-8")


def test_upload_core_uses_july24_transactional_large_pdf_handling():
    source = text("upload-fix.js")
    for marker in (
        "__pdfEditorUploadFixV6",
        "OPTIMIZED_PAGE_LIMIT = 120",
        "aggregateStats",
        "syncAggregateMode",
        "previous.parsedPages",
        "restorePaperState",
        "applyDetectedPaperSize",
        "EXTREME_PREVIEW_OUTPUT_LIMIT = 24",
    ):
        assert marker in source
    assert "window.eval(" not in source
    assert "setInterval(" not in source


def test_core_preview_helpers_use_bounded_bootstraps():
    for name in (
        "live-preview.js",
        "layout-export.js",
        "page-count-hint.js",
        "nup-helper.js",
        "divider-helper.js",
    ):
        assert "setInterval(" not in text(name)


def test_layout_export_only_patches_exact_same_origin_pdf_routes():
    source = text("layout-export.js")
    assert "url.origin !== location.origin" in source
    assert "path === '/api/pdf/process'" in source
    assert "path === '/api/pdf/process-storage'" in source
    assert "includes('/api/pdf/process')" not in source


def test_live_preview_remains_compatible_without_preview_controller():
    source = text("live-preview.js")
    assert "if (window.PdfPreviewController)" in source
    assert "typeof schedulePreview === 'function'" in source
    assert "typeof triggerPreview === 'function'" in source


def test_divider_keeps_magnetic_alignment_without_background_polling():
    source = text("divider-helper.js")
    assert "dividerGuideX" in source
    assert "setPartX" in source
    assert "attempt < 10" in source
