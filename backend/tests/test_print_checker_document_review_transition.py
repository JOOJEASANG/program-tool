from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_document_review_is_excluded_from_generic_product_loading_transition():
    transition = (ROOT / "js" / "print-checker" / "product-transition-v1.js").read_text(encoding="utf-8")
    index = (ROOT / "print-checker" / "index.html").read_text(encoding="utf-8")

    assert "const EXTERNAL_PRODUCTS = new Set(['book-review'])" in transition
    assert "function clearLoadingState(options = {})" in transition
    assert "if (options.invalidate !== false) serial += 1;" in transition
    assert "if (isExternalProduct(product)) {\n        clearLoadingState();\n        card.dataset.transitionToken = '';\n        return;" in transition
    assert "if (isExternalProduct(product)) {\n        clearLoadingState();\n        return;" in transition
    assert "/js/print-checker/product-transition-v1.js?v=20260930-2" in index
