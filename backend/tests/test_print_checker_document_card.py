from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_document_file_review_is_moved_to_advanced_editor():
    page = read("print-checker/index.html")
    bridge = read("js/print-checker/design-review-step1.js")
    legacy = read("js/print-checker/book-review.js")
    advanced = read("js/pdf-editor-advanced/print-review.js")
    validation = read("js/pdf-editor-advanced/print-review-validation.js")
    loader = read("js/pdf-editor-advanced/facing-upload.js")

    assert 'data-product="book-review"' not in bridge
    assert "ensureDocumentFileCard" not in bridge
    assert "documentCardObserver" not in bridge

    assert "print-checker-book-review.css" not in page
    assert "repairDocumentReview" not in page
    assert "PrintCheckerDocumentReviewUiFix" not in page
    assert "/js/print-checker/book-review.js?v=20260930-3" in page

    assert "params.get('product') === 'book-review'" in legacy
    assert "location.replace(target)" in legacy
    assert "document-review-moved-to-pdf-editor-advanced-v2" in legacy

    assert "문서 인쇄 검토" in advanced
    assert "인쇄용지 중앙 배치" in advanced
    assert "사방 재단표시" in advanced
    assert "전체 페이지 검사" in advanced
    assert "실제 재단 폭과 높이를 모두 입력" in validation
    assert "event.stopImmediatePropagation()" in validation
    assert "import './print-review.js';" in loader
    assert "import './print-review-validation.js';" in loader
