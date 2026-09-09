from __future__ import annotations

import fitz

from models.advanced_schemas import AdvancedPageInfo, PdfAdvancedProcessRequest
from models.schemas import HeaderFooterSettings, PageNumberSettings
from services.pdf_advanced_engine import process_advanced_pdf_bytes


def _two_page_source() -> bytes:
    doc = fitz.open()
    for _ in range(2):
        page = doc.new_page(width=300, height=400)
        page.insert_text((120, 200), "BODY", fontsize=10)
    data = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    return data


def _text_x(page: fitz.Page, needle: str) -> float:
    hits = page.search_for(needle)
    assert hits, f"missing text: {needle}"
    return hits[0].x0


def test_facing_pages_mirror_overlay_sides_in_final_pdf():
    request = PdfAdvancedProcessRequest(
        pages=[
            AdvancedPageInfo(file_index=0, page_index=0),
            AdvancedPageInfo(file_index=0, page_index=1),
        ],
        margins={
            "left_mm": 10,
            "right_mm": 30,
            "top_mm": 12,
            "bottom_mm": 12,
            "facing_pages": True,
        },
        header_footer=HeaderFooterSettings(
            enabled=True,
            header_left="LEFT",
            header_right="RIGHT",
            font_size=9,
            color="#222222",
            margin_mm=5,
        ),
        page_numbers=PageNumberSettings(
            enabled=True,
            position="bottom-left",
            format="1",
            start=1,
            font_size=9,
            color="#222222",
            margin_mm=5,
        ),
    )
    result = process_advanced_pdf_bytes([_two_page_source()], request)
    output = fitz.open(stream=result, filetype="pdf")
    try:
        first, second = output[0], output[1]
        assert _text_x(first, "LEFT") < _text_x(first, "RIGHT")
        assert _text_x(second, "RIGHT") < _text_x(second, "LEFT")
        assert _text_x(first, "1") < first.rect.width / 2
        assert _text_x(second, "2") > second.rect.width / 2
    finally:
        output.close()
