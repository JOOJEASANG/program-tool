"""Booklet fold is physical sheet midline; optional source whitespace adjustment.

Check actual vector PDF pixels. Source images with baked-in white stripes are
different from page placement gaps: the latter are already zero by geometry.
"""
import fitz
import pytest

from models.schemas import NupValue, PageInfo, PaperSize, PdfProcessRequest
from services.pdf_engine import build_pdf_document
from services.pdf_ops import MM_TO_PT, _booklet_reorder


def create_artwork_with_inner_white_strips():
    doc = fitz.open()
    m = MM_TO_PT
    left_numbers = {8, 2, 6, 4}
    for number in range(1, 9):
        page = doc.new_page(width=100*m, height=140*m)
        if number in left_numbers:
            ink = fitz.Rect(0, 0, 94*m, 140*m)
            color = (1, 0.1, 0.1)
        else:
            ink = fitz.Rect(6*m, 0, 100*m, 140*m)
            color = (0.1, 0.2, 1)
        page.draw_rect(ink, fill=color, color=None, overlay=False)
        page.insert_text((10*m, 15*m), f"P{number}", fontsize=12, color=(0, 0, 0))
    return doc


def create_request(shift, *, size=True):
    return PdfProcessRequest(
        pages=[PageInfo(file_index=0, page_index=i) for i in range(8)],
        paper=PaperSize(width_mm=297, height_mm=210),
        nup_default=NupValue(2),
        booklet=True,
        booklet_spine_align=True,
        booklet_inner_shift_mm=shift,
        placement_width_mm=100 if size else None,
        placement_height_mm=140 if size else None,
        margin_h_mm=10,
        margin_v_mm=10,
        gap_mm=20,
        add_border=False,
    )


def rgb_at_mm(page, x_mm, y_mm):
    pix = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
    x = round(x_mm*MM_TO_PT)
    y = round(y_mm*MM_TO_PT)
    return pix.pixel(x, y)[:3]


@pytest.mark.parametrize("shift", [0, 6])
def test_vector_pdf_clips_inward_source_shift_to_leaf(shift):
    source = create_artwork_with_inner_white_strips()
    output = build_pdf_document([source], create_request(shift))
    try:
        assert output.page_count == 4
        for face in output:
            assert face.rect.width == pytest.approx(297 * MM_TO_PT, abs=0.2)
            assert face.rect.height == pytest.approx(210 * MM_TO_PT, abs=0.2)
            left_rgb = rgb_at_mm(face, 147.5, 105)
            right_rgb = rgb_at_mm(face, 149.5, 105)
            if shift == 0:
                assert min(left_rgb) > 235 and min(right_rgb) > 235, (left_rgb, right_rgb)
            else:
                assert left_rgb[0] > 180 and left_rgb[1] < 100 and left_rgb[2] < 100, left_rgb
                assert right_rgb[2] > 180 and right_rgb[0] < 100 and right_rgb[1] < 150, right_rgb
                # The opposite colors must not cross the true center seam.
                assert left_rgb[0] > left_rgb[2]
                assert right_rgb[2] > right_rgb[0]
    finally:
        output.close()
        source.close()


def test_large_booklet_155_pages_pads_to_156_and_preserves_78_faces():
    original = [PageInfo(file_index=0, page_index=i) for i in range(155)]
    imposed = _booklet_reorder(original, 2)
    assert len(imposed) == 156
    assert sum(page.page_type == "blank" for page in imposed) == 1
    assert len(imposed) // 2 == 78
    assert sorted(p.page_index for p in imposed if p.page_type != "blank") == list(range(155))


def test_inner_shift_is_rejected_above_20mm_and_keeps_legacy_default():
    with pytest.raises(ValueError):
        PdfProcessRequest.model_validate({
            "pages":[{"file_index":0,"page_index":0}],
            "booklet_inner_shift_mm":25,
        })
    request=PdfProcessRequest(pages=[PageInfo(file_index=0,page_index=0)])
    assert request.booklet_inner_shift_mm == 0


def test_booklet_source_shift_is_independent_of_print_sheet_and_one_side_size():
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    html = (root / "pdf-editor/index.html").read_text(encoding="utf-8")
    layout = (root / "js/pdf-editor/layout-export.js").read_text(encoding="utf-8")
    backend = (root / "backend/services/pdf_engine.py").read_text(encoding="utf-8")
    assert 'id="bookletInnerShiftMm"' in html
    assert "booklet_inner_shift_mm: getBookletInnerShiftMm()" in html
    assert "booklet_inner_shift_mm = settings.booklet_spine_align" in layout
    assert "context.clip();" in layout
    assert "fold_inner_shift_pt=fold_inner_shift_pt" in backend
    assert "fold_inner_shift_pt: float = 0.0" in backend
    assert "painted_target = fitz.Rect(" in backend
