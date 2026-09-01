from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "js" / "pdf-preflight" / "route-runtime.js"
FINALIZER = ROOT / "js" / "pdf-utility-image-converter-finalize.js"
CONVERTER = ROOT / "js" / "pdf-utility-image-converter.js"


def test_image_converter_reconciles_after_final_pdf_utility_layout():
    runtime = RUNTIME.read_text(encoding="utf-8")
    source = FINALIZER.read_text(encoding="utf-8")
    assert "pdfUtilityImageConverterFinalizeScriptV1" in runtime
    assert "/js/pdf-utility-image-converter-finalize.js?v=20260827-2" in runtime
    assert ".pdfuw-action-grid.single" in source
    assert "pdfUtilityImageConverterFinalized" in source
    assert "MutationObserver" in source


def test_image_converter_exposes_300dpi_and_above_without_duplicate_converter_code():
    source = FINALIZER.read_text(encoding="utf-8")
    converter = CONVERTER.read_text(encoding="utf-8")
    for dpi in ("300", "400", "600"):
        assert dpi in source
    assert "MAX_BYTES = 500 * 1024 * 1024" in converter
    assert "MAX_PAGES = 100" in converter
    assert "function contain" in converter


def test_finalizer_does_not_use_unbounded_polling():
    source = FINALIZER.read_text(encoding="utf-8")
    assert "setInterval(" not in source
    assert "attempts < 80" in source
