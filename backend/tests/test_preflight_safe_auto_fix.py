from pathlib import Path

import fitz
import pytest

from services.preflight_auto_fix import auto_fix_pdf_bytes

ROOT = Path(__file__).resolve().parents[2]
MM = 72 / 25.4


def sample_pdf(sizes=((180, 240), (130, 180))):
    doc = fitz.open()
    try:
        for i, (width, height) in enumerate(sizes):
            page = doc.new_page(width=width, height=height)
            page.draw_rect(fitz.Rect(0, 0, width, height), fill=(1, 0, 0))
            page.insert_text((14, 24), f"PAGE {i+1}", fontsize=12)
        return doc.tobytes(garbage=4, deflate=True)
    finally:
        doc.close()


def test_cmyk_converts_rgb_and_rasterizes_fonts_without_padding():
    source = sample_pdf()
    result = auto_fix_pdf_bytes(source, convert_cmyk=True, render_dpi=300)
    assert result.color_mode.startswith("CMYK")
    assert result.page_count == 2
    assert result.font_rasterized
    doc = fitz.open(stream=result.data, filetype="pdf")
    try:
        assert len(doc) == 2
        assert [(round(page.rect.width), round(page.rect.height)) for page in doc] == [(180, 240), (130, 180)]
        for page in doc:
            info = page.get_image_info()
            assert len(info) == 1
            assert info[0]["colorspace"] == 4
            assert not page.get_text().strip()
    finally:
        doc.close()


def test_bleed_adds_three_mm_without_altering_original_trim_dimensions():
    source = sample_pdf(((180, 240),))
    result = auto_fix_pdf_bytes(source, add_bleed_mm=3, safe_margin_mm=3, render_dpi=200)
    assert result.added_bleed_mm == 3
    fixed = fitz.open(stream=result.data, filetype="pdf")
    try:
        page = fixed[0]
        assert abs(page.mediabox.width - (180 + 6 * MM)) < 0.3
        assert abs(page.mediabox.height - (240 + 6 * MM)) < 0.3
        assert abs(page.trimbox.width - 180) < 0.3
        assert abs(page.trimbox.height - 240) < 0.3
        assert len(page.get_image_info()) == 1
    finally:
        fixed.close()


def test_transparency_and_font_modes_create_flattened_raster():
    source = sample_pdf(((180, 240),))
    result = auto_fix_pdf_bytes(source, protect_fonts=True, flatten_transparency=True)
    fixed = fitz.open(stream=result.data, filetype="pdf")
    try:
        assert len(fixed) == 1
        assert fixed[0].get_image_info()
        assert fixed[0].get_text() == ""
    finally:
        fixed.close()


def test_old_page_padding_and_normalizing_parameters_removed():
    source = sample_pdf(((180, 240),))
    with pytest.raises(ValueError, match="하나 이상"):
        auto_fix_pdf_bytes(source)
    with pytest.raises(TypeError):
        auto_fix_pdf_bytes(source, normalize_page_size=True)
    with pytest.raises(TypeError):
        auto_fix_pdf_bytes(source, pad_mode="even")
    with pytest.raises(ValueError, match="DPI"):
        auto_fix_pdf_bytes(source, convert_cmyk=True, render_dpi=72)
    with pytest.raises(ValueError, match="도련"):
        auto_fix_pdf_bytes(source, add_bleed_mm=4)


def test_frontend_and_routes_offer_new_print_workflow():
    frontend = (ROOT / "js" / "pdf-print-auto-fix.js").read_text(encoding="utf-8")
    runtime = (ROOT / "js" / "pdf-preflight" / "route-runtime.js").read_text(encoding="utf-8")
    bridge = (ROOT / "js" / "pdf-suite" / "direct-tool-bridge.js").read_text(encoding="utf-8")
    router = (ROOT / "backend" / "routers" / "preflight_auto_fix.py").read_text(encoding="utf-8")
    for feature in (
        "RGB → CMYK", "폰트 모양 고정", "투명도·그림자 병합",
        "3mm 도련 보조 생성", "안전여백 3mm 확보", "저해상도 선명도",
        "수정 전 · 수정 후 비교", "확인 후 출력용 PDF 저장",
        "await window.apiPreflightCheck", "render_dpi",
    ):
        assert feature in frontend
    assert "페이지 규격 자동 통일" not in frontend
    assert "양면 인쇄용 짝수" not in frontend
    assert "소책자용 4의 배수" not in frontend
    assert "PdfPrintAutoFix?.mountStandalone" in bridge
    assert "pdfPrintAutoFixScriptV1" in runtime
    assert "/api/preflight/auto-fix" in frontend
    assert '@preflight_auto_fix_bp.route("/auto-fix"' in router
    assert '@preflight_auto_fix_bp.route("/auto-fix-storage"' in router
