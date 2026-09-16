import fitz
import pytest

from services.smart_print_layout import SourceItem, render_layout_pdf
from services.smart_print_layout_auto import build_auto_fill_layout_plan
from services.smart_print_numbering import (
    apply_layout_numbering,
    expand_layout_for_numbering,
    format_number,
    parse_numbering_options,
)


MM_TO_PT = 72.0 / 25.4


def _source(width_mm=90.0, height_mm=50.0):
    doc = fitz.open()
    page = doc.new_page(width=width_mm * MM_TO_PT, height=height_mm * MM_TO_PT)
    page.draw_rect(page.rect, color=None, fill=(0.85, 0.9, 0.95))
    page.insert_text((12, 22), 'SOURCE')
    return doc


def _duplex_source(width_mm=90.0, height_mm=50.0):
    doc = fitz.open()
    for label in ('FRONT', 'BACK'):
        page = doc.new_page(width=width_mm * MM_TO_PT, height=height_mm * MM_TO_PT)
        page.draw_rect(page.rect, color=None, fill=(0.85, 0.9, 0.95))
        page.insert_text((12, 22), label)
    return doc


def _auto_plan():
    item = SourceItem(0, 'ticket.pdf', 90.0, 50.0, 1, 1)
    return build_auto_fill_layout_plan([item], 210.0, 297.0, 5.0, 3.0, True, False, 'long')


def _duplex_plan():
    item = SourceItem(0, 'ticket.pdf', 90.0, 50.0, 2, 1)
    return build_auto_fill_layout_plan([item], 210.0, 297.0, 5.0, 3.0, True, True, 'long')


def test_numbering_end_expands_sheets_and_truncates_last_sheet_exactly():
    base = _auto_plan()
    capacity = len(base.sheets[0])
    requested = capacity * 2 + 3
    expanded = expand_layout_for_numbering(base, {
        'enabled': True,
        'start': 101,
        'end': 101 + requested - 1,
    })

    assert len(expanded.sheets) == 3
    assert [len(sheet) for sheet in expanded.sheets] == [capacity, capacity, 3]
    assert sum(len(sheet) for sheet in expanded.sheets) == requested
    assert expanded.total_copies == requested
    assert [placement.copy_index for sheet in expanded.sheets for placement in sheet] == list(range(requested))


def test_numbering_range_validation_caps_single_job_at_2000_numbers():
    with pytest.raises(ValueError, match='최대 2,000개'):
        parse_numbering_options({'enabled': True, 'start': 1, 'end': 2001})
    with pytest.raises(ValueError, match='시작번호보다'):
        parse_numbering_options({'enabled': True, 'start': 10, 'end': 9})


def test_prefix_transparent_background_fixed_font_bold_and_color_are_parsed():
    options = parse_numbering_options({
        'enabled': True,
        'start': 7,
        'end': 10,
        'prefix': '입장권-',
        'font': 'helvetica-bold',
        'transparent_background': True,
        'bold': True,
        'color': '#C026D3',
    })
    assert options.end == 10
    assert options.prefix == '입장권-'
    assert options.font == 'korean'
    assert options.transparent_background is True
    assert options.bold is True
    assert options.color == '#c026d3'
    assert format_number(7, 'pad3', options.prefix) == '입장권- 007'

    with pytest.raises(ValueError, match='글씨 색상'):
        parse_numbering_options({'enabled': True, 'color': 'red'})


def test_prefix_and_number_use_exactly_one_space_after_trimming():
    assert format_number(1, 'pad3', '티켓') == '티켓 001'
    assert format_number(1, 'pad3', '티켓   ') == '티켓 001'
    assert format_number(1, 'pad3', '') == '001'


def test_numbering_target_side_validation_defaults_to_both():
    assert parse_numbering_options({'enabled': True}).target_side == 'both'
    assert parse_numbering_options({'enabled': True, 'target_side': 'front'}).target_side == 'front'
    assert parse_numbering_options({'enabled': True, 'target_side': 'back'}).target_side == 'back'
    with pytest.raises(ValueError, match='적용 면'):
        parse_numbering_options({'enabled': True, 'target_side': 'middle'})


def test_legacy_font_setting_is_ignored_and_korean_default_renders_saved_pdf():
    source = _source()
    try:
        plan = _auto_plan()
        plan = expand_layout_for_numbering(plan, {'enabled': True, 'start': 1, 'end': 1})
        base = render_layout_pdf([source], plan, gap_mm=3.0, crop_marks=False)
        numbered = apply_layout_numbering(base, plan, {
            'enabled': True,
            'start': 1,
            'end': 1,
            'prefix': '입장권',
            'font': 'times-bold-italic',
            'format': 'pad3',
            'transparent_background': True,
            'bold': True,
            'color': '#2563eb',
        })
        output = fitz.open(stream=numbered, filetype='pdf')
        try:
            text = output[0].get_text()
            assert '입장권 001' in text
            assert '\ufffd' not in text
        finally:
            output.close()
    finally:
        source.close()


def test_numbering_offsets_move_saved_pdf_label_from_selected_anchor_and_legacy_margins_are_ignored():
    source = _source()
    try:
        plan = _auto_plan()
        plan = expand_layout_for_numbering(plan, {'enabled': True, 'start': 1, 'end': 1})
        base = render_layout_pdf([source], plan, gap_mm=3.0, crop_marks=False)

        def number_rect(offset_x, offset_y, legacy_margin=1.5):
            numbered = apply_layout_numbering(base, plan, {
                'enabled': True,
                'start': 1,
                'end': 1,
                'format': 'pad3',
                'position': 'top-center',
                'offset_x_mm': offset_x,
                'offset_y_mm': offset_y,
                'margin_x_mm': legacy_margin,
                'margin_y_mm': legacy_margin,
                'transparent_background': True,
            })
            output = fitz.open(stream=numbered, filetype='pdf')
            try:
                matches = output[0].search_for('001')
                assert matches
                return fitz.Rect(matches[-1])
            finally:
                output.close()

        origin = number_rect(0, 0, 1.5)
        same_origin_with_old_margin = number_rect(0, 0, 20)
        moved = number_rect(8, 6, 20)
        assert abs(same_origin_with_old_margin.x0 - origin.x0) < 0.2
        assert abs(same_origin_with_old_margin.y0 - origin.y0) < 0.2
        assert moved.x0 > origin.x0
        assert moved.y0 > origin.y0
    finally:
        source.close()


@pytest.mark.parametrize(
    ('target_side', 'front_has_number', 'back_has_number'),
    [
        ('front', True, False),
        ('back', False, True),
        ('both', True, True),
    ],
)
def test_duplex_numbering_can_target_front_back_or_both(target_side, front_has_number, back_has_number):
    source = _duplex_source()
    try:
        plan = _duplex_plan()
        plan = expand_layout_for_numbering(plan, {'enabled': True, 'start': 1, 'end': 1})
        base = render_layout_pdf([source], plan, gap_mm=3.0, crop_marks=False)
        numbered = apply_layout_numbering(base, plan, {
            'enabled': True,
            'start': 1,
            'end': 1,
            'target_side': target_side,
            'format': 'pad3',
            'transparent_background': True,
        })
        output = fitz.open(stream=numbered, filetype='pdf')
        try:
            assert ('001' in output[0].get_text()) is front_has_number
            assert ('001' in output[1].get_text()) is back_has_number
        finally:
            output.close()
    finally:
        source.close()


def test_back_only_numbering_rejects_single_sided_layout():
    source = _source()
    try:
        plan = _auto_plan()
        base = render_layout_pdf([source], plan, gap_mm=3.0, crop_marks=False)
        with pytest.raises(ValueError, match='단면 출력'):
            apply_layout_numbering(base, plan, {
                'enabled': True,
                'target_side': 'back',
                'start': 1,
            })
    finally:
        source.close()
