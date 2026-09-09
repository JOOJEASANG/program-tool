import fitz

from services.smart_print_layout import (
    SourceItem,
    build_layout_plan,
    mirror_back_placement,
    render_layout_pdf,
)


MM_TO_PT = 72.0 / 25.4


def _source(width_mm=90.0, height_mm=50.0, duplex=False):
    doc = fitz.open()
    front = doc.new_page(width=width_mm * MM_TO_PT, height=height_mm * MM_TO_PT)
    front.insert_text((12, 22), "FRONT")
    if duplex:
        back = doc.new_page(width=width_mm * MM_TO_PT, height=height_mm * MM_TO_PT)
        back.insert_text((12, 22), "BACK")
    return doc


def test_card_quantity_is_packed_across_five_a3_sheets():
    item = SourceItem(
        file_index=0,
        name="card.pdf",
        width_mm=90.0,
        height_mm=50.0,
        page_count=2,
        quantity=100,
    )
    plan = build_layout_plan(
        [item],
        paper_width_mm=297.0,
        paper_height_mm=420.0,
        margin_mm=5.0,
        gap_mm=3.0,
        allow_rotate=True,
        duplex=True,
        flip_edge="long",
    )

    assert len(plan.sheets) == 5
    assert [len(sheet) for sheet in plan.sheets] == [21, 21, 21, 21, 16]
    assert plan.total_copies == 100


def test_rotation_can_reduce_sheet_count():
    item = SourceItem(
        file_index=0,
        name="ticket.pdf",
        width_mm=100.0,
        height_mm=150.0,
        page_count=1,
        quantity=2,
    )
    without_rotation = build_layout_plan(
        [item], 210.0, 297.0, 5.0, 3.0, False, False, "long"
    )
    with_rotation = build_layout_plan(
        [item], 210.0, 297.0, 5.0, 3.0, True, False, "long"
    )

    assert len(without_rotation.sheets) == 2
    assert len(with_rotation.sheets) == 1
    assert any(placement.rotated for placement in with_rotation.sheets[0])


def test_duplex_back_position_mirrors_on_requested_flip_edge():
    item = SourceItem(0, "card.pdf", 90.0, 50.0, 2, 1)
    plan = build_layout_plan([item], 297.0, 420.0, 5.0, 3.0, True, True, "long")
    front = plan.sheets[0][0]

    long_back = mirror_back_placement(front, 297.0, 420.0, "long")
    short_back = mirror_back_placement(front, 297.0, 420.0, "short")

    assert abs(long_back.x_mm - (297.0 - front.x_mm - front.width_mm)) < 1e-6
    assert abs(long_back.y_mm - front.y_mm) < 1e-6
    assert abs(short_back.x_mm - front.x_mm) < 1e-6
    assert abs(short_back.y_mm - (420.0 - front.y_mm - front.height_mm)) < 1e-6


def test_rendered_duplex_pdf_alternates_front_and_back_pages():
    source = _source(90.0, 50.0, duplex=True)
    try:
        item = SourceItem(0, "card.pdf", 90.0, 50.0, 2, 3)
        plan = build_layout_plan([item], 210.0, 297.0, 5.0, 3.0, True, True, "long")
        output_bytes = render_layout_pdf([source], plan, gap_mm=3.0, crop_marks=False)
        output = fitz.open(stream=output_bytes, filetype="pdf")
        try:
            assert output.page_count == len(plan.sheets) * 2
            assert "FRONT" in output[0].get_text()
            assert "BACK" in output[1].get_text()
        finally:
            output.close()
    finally:
        source.close()
