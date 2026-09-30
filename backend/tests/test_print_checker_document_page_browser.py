from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "js" / "print-checker" / "book-review.js"
CSS = ROOT / "css" / "print-checker-book-review.css"
INDEX = ROOT / "print-checker" / "index.html"


def test_document_review_has_right_side_full_page_browser():
    source = JS.read_text(encoding="utf-8")
    styles = CSS.read_text(encoding="utf-8")
    page = INDEX.read_text(encoding="utf-8")

    for marker in (
        "전체 페이지",
        "bookReviewThumbs",
        "renderPageThumbs",
        "renderThumbnail",
        "IntersectionObserver",
        "button.addEventListener('click', () => showPage(pageNumber))",
        "showPage,",
    ):
        assert marker in source

    assert "grid-template-columns:minmax(0,1fr) 270px" in styles
    assert "#bookReviewPageNav{grid-column:2;grid-row:1" in styles
    assert "height:calc(100vh - 28px)" in styles
    assert "/css/print-checker-book-review.css?v=20260930-3" in page
    assert "/js/print-checker/book-review.js?v=20260930-3" in page


def test_document_preview_auto_fits_available_width_and_height():
    source = JS.read_text(encoding="utf-8")

    assert "const wrapHeight = wrap?.clientHeight" in source
    assert "const displayH = Math.max(340" in source
    assert "const pxPerMm = Math.min(maxSheetW / sheetW, maxSheetH / sheetH);" in source
    assert "window.addEventListener('resize', schedulePreviewFit);" in source
