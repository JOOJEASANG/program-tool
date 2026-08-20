from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
APP_VERSION = ROOT / "js" / "app-version.js"
FIRST_PAINT = ROOT / "js" / "pdf-utility-first-paint.js"
CONVERTER = ROOT / "js" / "pdf-utility-image-converter.js"


def test_pdf_utility_loads_first_paint_guard_before_converter():
    app = APP_VERSION.read_text(encoding="utf-8")
    assert "pdfUtilityFirstPaintScriptV1" in app
    assert "pdfUtilityFirstPaintScriptV1','/js/pdf-utility-first-paint.js?v=20260821-1'" in app
    assert app.index("pdfUtilityFirstPaintScriptV1") < app.index("pdfUtilityImageConverterScriptV1")


def test_first_paint_guard_has_timeout_and_waits_for_final_layout():
    source = FIRST_PAINT.read_text(encoding="utf-8")
    assert "pdfu-first-paint-pending" in source
    assert "pdfUtilityWideLayout === '1'" in source
    assert "attempts < 120" in source
    assert "setTimeout(check, 50)" in source


def test_image_converter_card_uses_polished_presentation_without_changing_limits():
    source = FIRST_PAINT.read_text(encoding="utf-8")
    converter = CONVERTER.read_text(encoding="utf-8")
    assert "pdfu-image-converter-polished" in source
    assert "PDF → JPG / PNG" in source
    assert "JPG / PNG → PDF" in source
    assert "변환 설정 열기" in source
    assert "MAX_BYTES = 500 * 1024 * 1024" in converter
    assert "MAX_PAGES = 100" in converter
