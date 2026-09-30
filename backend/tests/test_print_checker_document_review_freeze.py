from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "print-checker" / "index.html"


def test_document_review_ui_fix_is_bounded_without_global_dom_observer():
    source = INDEX.read_text(encoding="utf-8")

    assert 'window.PrintCheckerBookReview?.activate?.();' in source
    assert 'repairDocumentReview();' in source
    assert 'window.setTimeout(repairDocumentReview, 80);' in source
    assert 'new MutationObserver(repairDocumentReview)' not in source
    assert "stage: 'document-review-ui-fix-v2'" in source
