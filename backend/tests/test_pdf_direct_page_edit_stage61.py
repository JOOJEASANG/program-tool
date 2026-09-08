import fitz
import pytest
from pydantic import ValidationError

from models.schemas import PageEraseRegion, PageInfo, PaperSize, PdfProcessRequest
from services import pdf_ops
from services.pdf_engine import process_pdf_bytes


def _solid_black_pdf(width_pt: float = 100.0, height_pt: float = 100.0) -> bytes:
    doc = fitz.open()
    try:
        page = doc.new_page(width=width_pt, height=height_pt)
        page.draw_rect(page.rect, color=None, fill=(0.0, 0.0, 0.0), overlay=True)
        return doc.tobytes(garbage=4, deflate=True)
    finally:
        doc.close()


def _request_with_center_erase() -> PdfProcessRequest:
    mm = 100.0 / pdf_ops.MM_TO_PT
    return PdfProcessRequest(
        pages=[
            PageInfo(
                file_index=0,
                page_index=0,
                rotation=0,
                rotation_locked=True,
                erase_regions=[
                    PageEraseRegion(x0=0.40, y0=0.40, x1=0.60, y1=0.60)
                ],
            )
        ],
        paper=PaperSize(width_mm=mm, height_mm=mm),
        margin_h_mm=0,
        margin_v_mm=0,
        margin_left_mm=0,
        margin_right_mm=0,
        margin_top_mm=0,
        margin_bottom_mm=0,
        gap_mm=0,
    )


def test_erase_region_requires_positive_normalized_rectangle():
    with pytest.raises(ValidationError):
        PageEraseRegion(x0=0.8, y0=0.2, x1=0.3, y1=0.6)

    with pytest.raises(ValidationError):
        PageEraseRegion(x0=-0.1, y0=0.2, x1=0.3, y1=0.6)


def test_direct_edit_whiteout_is_rendered_into_downloaded_pdf():
    output = process_pdf_bytes([_solid_black_pdf()], _request_with_center_erase())
    doc = fitz.open(stream=output, filetype="pdf")
    try:
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
        center = pix.pixel(pix.width // 2, pix.height // 2)
        corner = pix.pixel(max(1, pix.width // 10), max(1, pix.height // 10))
        assert min(center[:3]) >= 245
        assert max(corner[:3]) <= 15
    finally:
        doc.close()


def test_page_info_limits_visual_cleanup_regions():
    regions = [
        PageEraseRegion(x0=0.01, y0=0.01, x1=0.02, y1=0.02)
        for _ in range(41)
    ]
    with pytest.raises(ValidationError):
        PageInfo(file_index=0, page_index=0, erase_regions=regions)
