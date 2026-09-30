from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GEOMETRY = ROOT / "js" / "print-checker" / "design-review-step1.js"


def test_document_review_isolated_from_remembered_design_geometry():
    source = GEOMETRY.read_text(encoding="utf-8")

    assert "function isDocumentReviewActive()" in source
    assert "document.body?.classList.contains('book-review-active')" in source
    assert "new URLSearchParams(location.search).get('product') === 'book-review'" in source
    assert "if (isDocumentReviewActive()) return;" in source
    assert "const observer = new MutationObserver(() => {" in source
