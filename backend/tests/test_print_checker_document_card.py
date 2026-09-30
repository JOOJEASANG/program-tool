from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_document_file_card_is_persistently_rendered_in_step1():
    bridge = read("js/print-checker/design-review-step1.js")
    page = read("print-checker/index.html")
    book_review = read("js/print-checker/book-review.js")

    for marker in (
        'data-product="book-review"',
        "문서파일",
        "PDF 문서·재단선·안전영역",
        "ensureDocumentFileCard",
        "documentCardObserver",
        "window.PrintCheckerBookReview?.activate?.()",
    ):
        assert marker in bridge

    assert "/js/print-checker/design-review-step1.js?v=20260930-4" in page
    assert "function activate()" in book_review
    assert "document.querySelectorAll('.product-card')" in book_review
