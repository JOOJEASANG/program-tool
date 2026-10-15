"""Booklet source pages meet at the center fold, with independent placed page sizes."""
import fitz
import pytest

from models.schemas import NupValue, PageInfo, PaperSize, PdfProcessRequest
from services.pdf_engine import _build_page_layout, _calc_rotated_fit_rect, build_pdf_document
from services.pdf_ops import MM_TO_PT


def test_booklet_cells_meet_at_true_fold_without_global_gap():
    m = MM_TO_PT
    for nup, rows in [(2, 1), (4, 2), (6, 3), (8, 4)]:
        layout = _build_page_layout(
            nup, 297*m, 210*m, (10*m, 10*m, 9*m, 9*m), 18*m,
            booklet=True, booklet_spine_align=True,
        )
        assert len(layout.cell_rects) == 2*rows
        for row in range(rows):
            left, right = layout.cell_rects[2*row:2*row+2]
            assert left.x1 == pytest.approx(148.5*m)
            assert right.x0 == pytest.approx(148.5*m)
            assert left.x0 == pytest.approx(10*m)
            assert right.x1 == pytest.approx(287*m)
            assert left.y0 == pytest.approx(right.y0)


def test_booklet_auto_fit_aligns_left_content_rightward_and_right_content_leftward():
    m = MM_TO_PT
    left = fitz.Rect(10*m, 10*m, 148.5*m, 200*m)
    right = fitz.Rect(148.5*m, 10*m, 287*m, 200*m)
    fitted_left = _calc_rotated_fit_rect(left, 50*m, 100*m, 0, "right")
    fitted_right = _calc_rotated_fit_rect(right, 50*m, 100*m, 0, "left")
    assert fitted_left.x1 == pytest.approx(148.5*m)
    assert fitted_right.x0 == pytest.approx(148.5*m)
    centered = _calc_rotated_fit_rect(left, 50*m, 100*m, 0)
    assert centered.x1 < 148.5*m


def test_full_vector_booklet_keeps_explicit_page_size_and_fold_alignment():
    m = MM_TO_PT
    src = fitz.open()
    for page_no in range(1, 5):
        page = src.new_page(width=110, height=180)
        page.insert_text((14, 55), f"PAGE{page_no}", fontsize=13)
    request = PdfProcessRequest(
        pages=[PageInfo(file_index=0, page_index=i) for i in range(4)],
        paper=PaperSize(width_mm=297, height_mm=210),
        nup_default=NupValue(2),
        booklet=True,
        booklet_spine_align=True,
        placement_width_mm=60,
        placement_height_mm=120,
        margin_h_mm=10,
        margin_v_mm=10,
        gap_mm=18,
        add_border=True,
    )
    result = build_pdf_document([src], request)
    try:
        assert result.page_count == 2
        assert (result[0].rect.width, result[0].rect.height) == pytest.approx((297*m, 210*m))
        labels = {w[4]: fitz.Rect(w[:4]) for w in result[0].get_text("words")}
        # Saddle stitch pairs last logical page (left) with first (right).
        assert "PAGE4" in labels and "PAGE1" in labels
        assert labels["PAGE4"].x1 <= 148.5*m
        assert labels["PAGE1"].x0 >= 148.5*m
        strokes = [item.get("rect") for item in result[0].get_drawings()
                   if item.get("type") == "s" and isinstance(item.get("rect"), fitz.Rect)]
        assert any(abs(rect.x1 - 148.5*m) < .5 and abs(rect.width - 60*m) < .5
                   for rect in strokes)
        assert any(abs(rect.x0 - 148.5*m) < .5 and abs(rect.width - 60*m) < .5
                   for rect in strokes)
    finally:
        result.close()
        src.close()


def test_spine_mode_is_opt_in_at_api_level():
    request = PdfProcessRequest(pages=[PageInfo(file_index=0, page_index=0)])
    assert request.booklet_spine_align is False
    assert request.placement_width_mm is None
