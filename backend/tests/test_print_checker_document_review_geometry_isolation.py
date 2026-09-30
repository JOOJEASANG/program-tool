from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GEOMETRY = ROOT / "js" / "print-checker" / "design-review-step1.js"
ADVANCED_REVIEW = ROOT / "js" / "pdf-editor-advanced" / "print-review.js"
LEGACY_REVIEW = ROOT / "js" / "print-checker" / "book-review.js"


def test_document_review_no_longer_depends_on_print_checker_geometry():
    geometry = GEOMETRY.read_text(encoding="utf-8")
    advanced = ADVANCED_REVIEW.read_text(encoding="utf-8")
    legacy = LEGACY_REVIEW.read_text(encoding="utf-8")

    assert "isDocumentReviewActive" not in geometry
    assert "book-review-active" not in geometry
    assert "data-product=\"book-review\"" not in geometry

    assert "advancedState" in advanced
    assert "renderPagePreview" in advanced
    assert "문서 인쇄 검토" in advanced
    assert "params.get('product') === 'book-review'" in legacy
    assert "location.replace(target)" in legacy
