"""Repeated print cells use symmetric margins relative to physical cut lines."""
import math

import fitz
import pytest

from models.schemas import HeaderFooterSettings, PageInfo, PageNumberSettings, PaperSize, PdfProcessRequest, NupValue
from services.pdf_engine import _build_page_layout, build_pdf_document
from services import pdf_ops


MM = pdf_ops.MM_TO_PT


@pytest.mark.parametrize("copies", [2, 4])
def test_repeat_cut_region_margins_match_on_every_trimmed_print(copies):
    paper_w, paper_h = 210 * MM, 297 * MM
    margins = (8 * MM, 12 * MM, 10 * MM, 14 * MM)
    layout = _build_page_layout(
        copies, paper_w, paper_h, margins, 5 * MM,
        repeat_cell_overlays=True,
    )
    assert len(layout.cell_rects) == copies
    assert len(layout.cut_rects) == copies
    assert math.isclose(sum(cut.get_area() for cut in layout.cut_rects), paper_w * paper_h, abs_tol=1e-5)
    for cut, content in zip(layout.cut_rects, layout.cell_rects):
        assert math.isclose(content.x0 - cut.x0, 8 * MM, abs_tol=1e-5)
        assert math.isclose(cut.x1 - content.x1, 12 * MM, abs_tol=1e-5)
        assert math.isclose(content.y0 - cut.y0, 10 * MM, abs_tol=1e-5)
        assert math.isclose(cut.y1 - content.y1, 14 * MM, abs_tol=1e-5)
    assert math.isclose(layout.cut_rects[0].width, paper_w / layout.cols, abs_tol=1e-5)
    assert math.isclose(layout.cut_rects[0].height, paper_h / layout.rows, abs_tol=1e-5)
    # N-UP gap must not move the equal-sized physical cut boundaries.
    without_gap = _build_page_layout(copies, paper_w, paper_h, margins, 0, repeat_cell_overlays=True)
    assert layout.cell_rects == without_gap.cell_rects


def test_nonrepeat_layout_keeps_original_paper_margin_and_gap():
    normal = _build_page_layout(2, 210 * MM, 297 * MM, (8*MM, 12*MM, 10*MM, 14*MM), 5*MM)
    assert not normal.cut_rects
    assert normal.cell_rects[0].y0 == 10 * MM
    assert normal.cell_rects[1].y0 > normal.cell_rects[0].y1


@pytest.mark.parametrize("copies", [2, 4])
def test_generated_pdf_repeated_content_and_footer_are_equally_aligned_after_cut(copies):
    source = fitz.open()
    src_page = source.new_page(width=270, height=380)
    src_page.insert_text((30, 60), "REPEATED", fontsize=15)
    request = PdfProcessRequest(
        pages=[PageInfo(file_index=0, page_index=0, group_break=(i==0), nup_override=NupValue(copies)) for i in range(copies)],
        nup_default=NupValue(copies),
        paper=PaperSize(width_mm=210, height_mm=297),
        margin_left_mm=8, margin_right_mm=12,
        margin_top_mm=10, margin_bottom_mm=14,
        gap_mm=18,
        repeat_cell_overlays=True,
        page_numbers=PageNumberSettings(enabled=True, start=3, position="bottom-center"),
        header_footer=HeaderFooterSettings(enabled=True, header_center="CUT"),
    )
    result = build_pdf_document([source], request)
    try:
        assert result.page_count == 1
        words = result[0].get_text("words")
        content = [w for w in words if w[4] == "REPEATED"]
        header = [w for w in words if w[4] == "CUT"]
        numbers = [w for w in words if w[4] == "3"]
        assert len(content) == len(header) == len(numbers) == copies
        layout = _build_page_layout(copies, 210*MM, 297*MM,
            (8*MM, 12*MM, 10*MM, 14*MM), 18*MM,
            repeat_cell_overlays=True)
        for group in (content, header, numbers):
            normalized = []
            for cut in layout.cut_rects:
                centered = [word for word in group if cut.contains(fitz.Point(word[0], word[1]))]
                assert len(centered) == 1
                normalized.append((centered[0][0] - cut.x0, centered[0][1] - cut.y0))
            for x, y in normalized[1:]:
                assert math.isclose(x, normalized[0][0], abs_tol=0.3)
                assert math.isclose(y, normalized[0][1], abs_tol=0.3)
    finally:
        result.close()
        source.close()


def test_repeat_invalid_individual_cut_margins_are_rejected():
    with pytest.raises(ValueError, match="개별 재단 영역"):
        _build_page_layout(4, 210 * MM, 297 * MM, (80*MM, 80*MM, 10*MM, 14*MM),
                           0, repeat_cell_overlays=True)
