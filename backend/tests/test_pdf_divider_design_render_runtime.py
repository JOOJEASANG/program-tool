import json

import fitz
import pytest

from services.pdf_divider_renderer import render_divider_page


@pytest.mark.parametrize("background_style", ["solid", "gradient", "soft", "diagonal", "grid", "spotlight"])
def test_divider_extended_design_renders_real_pdf(background_style):
    doc = fitz.open()
    content = {
        "title": "A long divider title for line one\nand line two",
        "subtitle": "Subtitle",
        "note": "Footer note",
        "noBg": False,
        "bg": "#1e3a8a",
        "bg2": "#dbeafe",
        "fg": "#ffffff",
        "bgStyle": background_style,
        "style": "modern",
        "shapeLayers": [
            {"kind": "rect", "x": 50, "y": 28, "width": 58, "height": 9, "fill": "#ffffff", "stroke": "#ffffff", "strokeWidth": 0, "opacity": 0.12},
            {"kind": "roundRect", "x": 50, "y": 44, "width": 76, "height": 15, "fill": "#ffffff", "stroke": "#ffffff", "strokeWidth": 1, "radius": 8, "opacity": 0.18},
            {"kind": "outline", "x": 50, "y": 64, "width": 64, "height": 12, "stroke": "#ffffff", "strokeWidth": 2, "opacity": 0.55},
            {"kind": "pill", "x": 50, "y": 74, "width": 42, "height": 7, "fill": "#dbeafe", "stroke": "#ffffff", "strokeWidth": 1, "opacity": 0.45},
            {"kind": "line", "x": 50, "y": 82, "width": 70, "height": 1, "stroke": "#ffffff", "strokeWidth": 1.5, "rotation": -4, "opacity": 0.5},
            {"kind": "circle", "x": 82, "y": 18, "width": 12, "height": 8, "fill": "#dbeafe", "stroke": "#ffffff", "strokeWidth": 1, "opacity": 0.25},
        ],
        "extraTexts": [
            {"text": "Section 01", "size": 16, "color": "#ffffff", "x": 50, "y": 36, "opacity": 0.75}
        ],
    }

    render_divider_page(doc, json.dumps(content), "modern", 595, 842)

    assert doc.page_count == 1
    data = doc.tobytes()
    assert data.startswith(b"%PDF")
    assert len(data) > 1500
    doc.close()


def test_divider_long_single_line_title_auto_wrap_path_renders():
    doc = fitz.open()
    content = {
        "title": "This is a deliberately long divider title that should use the automatic two line title wrapping path",
        "noBg": True,
        "style": "frame",
    }

    render_divider_page(doc, json.dumps(content), "frame", 595, 842)

    assert doc.page_count == 1
    assert len(doc.tobytes()) > 1000
    doc.close()
