from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_document_file_review_is_moved_to_advanced_editor():
    page = read("print-checker/index.html")
    bridge = read("js/print-checker/design-review-step1.js")
    legacy = read("js/print-checker/book-review.js")
    loader = read("js/pdf-editor-advanced/facing-upload.js")
    inline = read("js/pdf-editor-advanced/workspace-inline-review-v4.js")

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

    assert "import './workspace-inline-review-v4.js';" in loader
    assert "import './print-review.js';" not in loader
    assert "import './print-review-validation.js';" not in loader
    assert "파일 실제" in inline
    assert "재단사이즈" in inline
    assert "advancedTrimGuide" in inline
    assert "advanced-page-sidebar" in inline
