import fitz
import pytest

from services.smart_print_layout import LayoutPlan, Placement, SourceItem
from services.smart_print_trim import apply_trim_crop_marks, parse_trim_size, trim_rect_mm


MM_TO_PT = 72.0 / 25.4


def test_trim_size_requires_both_dimensions_when_required():
    with pytest.raises(ValueError, match='필수입력'):
        parse_trim_size({}, required=True)
    with pytest.raises(ValueError, match='모두 입력'):
        parse_trim_size({'trim_width_mm': 90}, required=False)
    assert parse_trim_size({'trim_width_mm': '90', 'trim_height_mm': '50'}, required=True) == (90.0, 50.0)


def test_trim_rect_is_centered_inside_uploaded_page_edge():
    placement = Placement(
        file_index=0,
        copy_index=0,
        x_mm=10.0,
        y_mm=20.0,
        width_mm=96.0,
        height_mm=56.0,
        rotated=False,
    )
    assert trim_rect_mm(placement, 90.0, 50.0) == pytest.approx((13.0, 23.0, 103.0, 73.0))


def test_trim_rect_swaps_dimensions_when_layout_rotates_source():
    placement = Placement(
        file_index=0,
        copy_index=0,
        x_mm=10.0,
        y_mm=20.0,
        width_mm=56.0,
        height_mm=96.0,
        rotated=True,
    )
    assert trim_rect_mm(placement, 90.0, 50.0) == pytest.approx((13.0, 23.0, 63.0, 113.0))


def test_crop_marks_are_added_to_front_and_back_using_trim_size():
    item = SourceItem(0, 'sample.pdf', 96.0, 56.0, 2, 1)
    placement = Placement(0, 0, 10.0, 10.0, 96.0, 56.0, False)
    plan = LayoutPlan(
        paper_width_mm=210.0,
        paper_height_mm=297.0,
        duplex=True,
        flip_edge='long',
        sheets=[[placement]],
        source_items=[item],
    )

    base = fitz.open()
    base.new_page(width=210.0 * MM_TO_PT, height=297.0 * MM_TO_PT)
    base.new_page(width=210.0 * MM_TO_PT, height=297.0 * MM_TO_PT)
    base_bytes = base.tobytes()
    base.close()

    marked = apply_trim_crop_marks(
        base_bytes,
        plan,
        enabled=True,
        gap_mm=3.0,
        trim_width_mm=90.0,
        trim_height_mm=50.0,
    )
    output = fitz.open(stream=marked, filetype='pdf')
    try:
        assert output.page_count == 2
        assert len(output[0].get_drawings()) >= 8
        assert len(output[1].get_drawings()) >= 8
    finally:
        output.close()


def test_crop_marks_require_trim_size_when_enabled():
    plan = LayoutPlan(210.0, 297.0, False, 'long', sheets=[], source_items=[])
    doc = fitz.open()
    doc.new_page(width=210.0 * MM_TO_PT, height=297.0 * MM_TO_PT)
    data = doc.tobytes()
    doc.close()
    with pytest.raises(ValueError, match='재단표시'):
        apply_trim_crop_marks(
            data,
            plan,
            enabled=True,
            gap_mm=3.0,
            trim_width_mm=None,
            trim_height_mm=None,
        )
