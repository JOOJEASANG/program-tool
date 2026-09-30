from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "js" / "pdf-editor-advanced" / "print-review.js"
LOADER = ROOT / "js" / "pdf-editor-advanced" / "facing-upload.js"


def test_document_review_has_right_side_full_page_browser():
    source = JS.read_text(encoding="utf-8")
    loader = LOADER.read_text(encoding="utf-8")

    for marker in (
        "전체 페이지",
        "aprThumbs",
        "rebuildThumbs",
        "renderThumb",
        "IntersectionObserver",
        "showPage(index + 1)",
        "전체 페이지 검사",
    ):
        assert marker in source

    assert "grid-template-columns:minmax(0,1fr) 260px" in source
    assert "body.print-review-active .advanced-print-review-workspace{display:grid}" in source
    assert "import './print-review.js';" in loader


def test_document_preview_auto_fits_available_width_and_height():
    source = JS.read_text(encoding="utf-8")

    assert "const width = Math.max(360, wrap.clientWidth - 18), height = Math.max(420, wrap.clientHeight - 18);" in source
    assert "const ppm = Math.min((canvas.width - 64) / sheetW, (canvas.height - 64) / sheetH);" in source
    assert "window.addEventListener('resize', scheduleResize);" in source


def test_document_review_keeps_trim_crop_marks_and_full_page_checks():
    source = JS.read_text(encoding="utf-8")

    for marker in (
        "drawCropMarks",
        "실제 재단",
        "safeZone",
        "bindingSafe",
        "inspectAll",
        "재단여유 부족",
        "인쇄용지 초과",
    ):
        assert marker in source
