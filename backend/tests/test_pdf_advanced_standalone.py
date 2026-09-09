from __future__ import annotations

import fitz

from models.advanced_schemas import AdvancedPageInfo, PdfAdvancedProcessRequest
from models.schemas import HeaderFooterSettings, PageEraseRegion, PageNumberSettings
from services.pdf_advanced_engine import process_advanced_pdf_bytes


def _source_pdf(width: float = 240, height: float = 360) -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=width, height=height)
    page.insert_text((24, 42), "ADVANCED SOURCE", fontsize=14)
    page.draw_rect(fitz.Rect(40, 70, 200, 300), color=(0, 0, 0), width=1)
    data = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    return data


def test_advanced_page_contract_has_no_nup_or_booklet_state():
    fields = set(AdvancedPageInfo.model_fields)
    assert {"edit_scale", "offset_x_mm", "offset_y_mm", "erase_regions"} <= fields
    assert not any("nup" in name.lower() or "booklet" in name.lower() for name in fields)


def test_standalone_engine_preserves_page_size_and_accepts_direct_edits():
    request = PdfAdvancedProcessRequest(
        pages=[
            AdvancedPageInfo(
                file_index=0,
                page_index=0,
                crop_left_ratio=0.05,
                crop_top_ratio=0.04,
                crop_right_ratio=0.03,
                crop_bottom_ratio=0.02,
                erase_regions=[PageEraseRegion(x0=0.1, y0=0.1, x1=0.2, y1=0.2)],
                edit_scale=1.18,
                offset_x_mm=4.0,
                offset_y_mm=-3.0,
            )
        ],
        margins={"left_mm": 7, "right_mm": 8, "top_mm": 9, "bottom_mm": 10},
    )
    result = process_advanced_pdf_bytes([_source_pdf()], request)
    output = fitz.open(stream=result, filetype="pdf")
    try:
        assert output.page_count == 1
        rect = output[0].rect
        assert abs(rect.width - 240) < 0.1
        assert abs(rect.height - 360) < 0.1
    finally:
        output.close()


def test_standalone_engine_rotation_swaps_output_size_without_layout_engine():
    request = PdfAdvancedProcessRequest(
        pages=[AdvancedPageInfo(file_index=0, page_index=0, rotation=90)]
    )
    result = process_advanced_pdf_bytes([_source_pdf(210, 330)], request)
    output = fitz.open(stream=result, filetype="pdf")
    try:
        rect = output[0].rect
        assert abs(rect.width - 330) < 0.1
        assert abs(rect.height - 210) < 0.1
    finally:
        output.close()


def test_standalone_engine_keeps_header_footer_and_page_numbers():
    request = PdfAdvancedProcessRequest(
        pages=[AdvancedPageInfo(file_index=0, page_index=0)],
        margins={"left_mm": 8, "right_mm": 8, "top_mm": 12, "bottom_mm": 12},
        header_footer=HeaderFooterSettings(
            enabled=True,
            header_center="HEADER {page}/{pages}",
            footer_center="FOOTER",
            font_size=9,
            color="#222222",
            margin_mm=5,
        ),
        page_numbers=PageNumberSettings(
            enabled=True,
            position="bottom-right",
            format="1/N",
            start=1,
            font_size=9,
            color="#222222",
            margin_mm=5,
        ),
    )
    result = process_advanced_pdf_bytes([_source_pdf()], request)
    output = fitz.open(stream=result, filetype="pdf")
    try:
        text = output[0].get_text()
        assert "HEADER 1/1" in text
        assert "FOOTER" in text
        assert "1/1" in text
    finally:
        output.close()


def test_advanced_crop_validation_rejects_empty_visible_area():
    try:
        AdvancedPageInfo(
            file_index=0,
            page_index=0,
            crop_left_ratio=0.5,
            crop_right_ratio=0.5,
        )
    except ValueError as exc:
        assert "95%" in str(exc)
    else:
        raise AssertionError("invalid crop must be rejected")
