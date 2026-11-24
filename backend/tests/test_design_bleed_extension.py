"""Upload-first bleed extension regression tests for print-production files."""
from __future__ import annotations

import io
from pathlib import Path

import fitz
import pytest
from PIL import Image

from services.design_bleed_extension import PT_PER_MM, extend_print_bleed

ROOT = Path(__file__).resolve().parents[2]


def make_pdf(sizes=((210, 297),)):
    doc = fitz.open()
    try:
        for index, (width, height) in enumerate(sizes, start=1):
            page = doc.new_page(width=width * PT_PER_MM, height=height * PT_PER_MM)
            page.draw_rect(
                fitz.Rect(0, 0, page.rect.width, page.rect.height),
                fill=(0.2, 0.5, 0.8), color=None,
            )
            page.insert_text((42, 72), f"VECTOR PAGE {index}", fontsize=18, color=(0, 0, 0))
        return doc.tobytes(garbage=4, deflate=True)
    finally:
        doc.close()


def make_png(color=(17, 80, 110)):
    image = Image.new("RGB", (600, 900), color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_a4_trim_remains_vector_and_bleed_is_outside_trim():
    source = make_pdf()
    result = extend_print_bleed(source, filename="customer-cover.pdf", bleed_mm=3)
    assert result.page_count == 1
    assert result.trim_width_mm == pytest.approx(210, abs=0.02)
    assert result.trim_height_mm == pytest.approx(297, abs=0.02)
    out = fitz.open(stream=result.pdf, filetype="pdf")
    try:
        page = out[0]
        assert page.mediabox.width / PT_PER_MM == pytest.approx(216, abs=0.02)
        assert page.mediabox.height / PT_PER_MM == pytest.approx(303, abs=0.02)
        assert page.trimbox.width / PT_PER_MM == pytest.approx(210, abs=0.02)
        assert page.trimbox.height / PT_PER_MM == pytest.approx(297, abs=0.02)
        assert page.bleedbox.width == pytest.approx(page.mediabox.width, abs=0.02)
        assert "VECTOR PAGE 1" in page.get_text()
        assert len(page.get_images(full=True)) >= 8
    finally:
        out.close()


def test_all_four_bleed_sides_are_filled_with_source_background():
    # A colored full-bleed source must produce colored outer pixels, not
    # white canvas at the positions where a real guillotine may cut.
    result = extend_print_bleed(make_pdf(), filename="customer.pdf", bleed_mm=3)
    doc = fitz.open(stream=result.pdf, filetype="pdf")
    try:
        pix = doc[0].get_pixmap(matrix=fitz.Matrix(1, 1), colorspace=fitz.csRGB, alpha=False)
        bpx = int(round(1.5 * PT_PER_MM))
        mid_x, mid_y = pix.width // 2, pix.height // 2
        for x, y in ((mid_x, bpx), (mid_x, pix.height - bpx - 1),
                     (bpx, mid_y), (pix.width - bpx - 1, mid_y)):
            red, green, blue = pix.pixel(x, y)[:3]
            assert blue > 155 and green > 75 and red < 120, (
                "Bleed has unfilled or unexpected background", (x, y), (red, green, blue)
            )
    finally:
        doc.close()


def test_multipage_pdf_each_page_is_extended_independently():
    source = make_pdf(((210, 297), (148, 210)))
    result = extend_print_bleed(source, filename="leaflet.pdf", bleed_mm=2, edge_mode="edge")
    out = fitz.open(stream=result.pdf, filetype="pdf")
    try:
        assert len(out) == 2
        assert "VECTOR PAGE 1" in out[0].get_text()
        assert "VECTOR PAGE 2" in out[1].get_text()
        assert out[0].trimbox.width / PT_PER_MM == pytest.approx(210, abs=.02)
        assert out[1].trimbox.width / PT_PER_MM == pytest.approx(148, abs=.02)
        assert result.page_count == 2
    finally:
        out.close()


def test_png_receives_selected_output_size_and_white_background():
    result = extend_print_bleed(
        make_png(), filename="invite.png",
        trim_width_mm=105, trim_height_mm=148,
        bleed_mm=3, edge_mode="mirror",
    )
    out = fitz.open(stream=result.pdf, filetype="pdf")
    try:
        page = out[0]
        assert page.trimbox.width / PT_PER_MM == pytest.approx(105, abs=.02)
        assert page.mediabox.width / PT_PER_MM == pytest.approx(111, abs=.02)
        assert len(page.get_images(full=True)) >= 9
    finally:
        out.close()


def test_invalid_size_file_and_option_are_rejected():
    source = make_pdf()
    with pytest.raises(ValueError, match="1~10mm"):
        extend_print_bleed(source, filename="x.pdf", bleed_mm=0)
    with pytest.raises(ValueError, match="완성 가로와 세로"):
        extend_print_bleed(source, filename="x.pdf", trim_width_mm=210)
    with pytest.raises(ValueError, match="10~1,500"):
        extend_print_bleed(source, filename="x.pdf", trim_width_mm=5, trim_height_mm=50)
    with pytest.raises(ValueError, match="방식"):
        extend_print_bleed(source, filename="x.pdf", edge_mode="invalid")
    with pytest.raises(ValueError, match="지원"):
        extend_print_bleed(source, filename="x.gif")
    with pytest.raises(ValueError, match="암호화"):
        encrypted = fitz.open(stream=source,filetype="pdf")
        try:
            protected = encrypted.tobytes(
                encryption=fitz.PDF_ENCRYPT_AES_256,
                owner_pw="owner", user_pw="pass",
            )
        finally:
            encrypted.close()
        extend_print_bleed(protected, filename="protected.pdf")


def test_replaced_ui_has_upload_compare_and_relevant_product_types():
    html = (ROOT / "ai-design-maker" / "index.html").read_text(encoding="utf-8")
    script = (ROOT / "js" / "design-bleed-enhancer.js").read_text(encoding="utf-8")
    service = (ROOT / "backend" / "services" / "design_bleed_extension.py").read_text(encoding="utf-8")
    router = (ROOT / "backend" / "routers" / "design_bleed.py").read_text(encoding="utf-8")
    main = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
    for marker in ("인쇄 디자인 보완", 'id="fileInput"', 'id="trimWidth"', 'id="bleedMm"',
                   'id="edgeMode"', 'id="beforeCanvas"', 'id="afterCanvas"', 'id="saveBtn"',
                   'value="leaflet2"', 'value="leaflet3"', 'value="invitation"'):
        assert marker in html
    assert 'src="/js/ai-design-maker.js' not in html
    assert "/js/design-bleed-enhancer.js" in html
    assert "디자인 생성" not in html
    assert "/api/design-bleed/extend" in script
    assert "page.set_trimbox(trim)" in service
    assert "page.set_bleedbox(page.mediabox)" in service
    assert 'show_pdf_page(trim, pdf, i' in service
    assert '@design_bleed_bp.route("/extend"' in router
    assert '@design_bleed_bp.route("/extend-storage"' in router
    assert 'flask_app.register_blueprint(design_bleed_bp, url_prefix="/api/design-bleed")' in main


def test_program_name_updated_across_home_and_help():
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    home = (ROOT / "js" / "pdf-suite-home-launcher.js").read_text(encoding="utf-8")
    manual = (ROOT / "js" / "program-manuals" / "ai-design-maker.js").read_text(encoding="utf-8")
    for content in (index, home):
        assert "name:'인쇄 디자인 보완'" in content
        assert "name:'표지 디자인'" not in content
        assert "url:'ai-design-maker/'" in content
    assert "name:'인쇄 디자인 보완'" in manual
    assert "거울 확장" in manual
    assert "도련" in manual


def test_design_bleed_endpoints_require_approved_program_account():
    from utils.permissions import program_for_path
    assert program_for_path("/api/design-bleed/extend") == "preflight"
    assert program_for_path("/api/design-bleed/extend-storage") == "preflight"
    assert program_for_path("/api/design-bleed-unrelated") is None
