from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_document_review_preview_is_centered_and_sidebar_fields_stay_inside():
    css = (ROOT / "css" / "print-checker-book-review.css").read_text(encoding="utf-8")
    index = (ROOT / "print-checker" / "index.html").read_text(encoding="utf-8")

    assert "grid-template-columns:minmax(0,1fr)" in css
    assert "width:min(100%,760px)" in css
    assert "max-width:760px" in css
    assert "#specForm .spec-input{width:100%;max-width:100%;min-width:0}" in css
    assert "/css/print-checker-book-review.css?v=20260930-2" in index


def test_document_review_blocks_flyer_defaults_from_overwriting_trim_inputs():
    index = (ROOT / "print-checker" / "index.html").read_text(encoding="utf-8")

    assert "PrintCheckerDocumentReviewUiFix" in index
    assert "event.stopPropagation()" in index
    assert "Number(trimW.value) === 210" in index
    assert "Number(trimH.value) === 297" in index
    assert "trimW.value = ''" in index
    assert "trimH.value = ''" in index
