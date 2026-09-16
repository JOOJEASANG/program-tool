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


def _auto_plan():
    item = SourceItem(0, 'ticket.pdf', 90.0, 50.0, 1, 1)
    return build_auto_fill_layout_plan([item], 210.0, 297.0, 5.0, 3.0, True, False, 'long')


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


def test_prefix_transparent_background_and_builtin_fonts_are_parsed():
    options = parse_numbering_options({
        'enabled': True,
        'start': 7,
        'end': 10,
        'prefix': '입장권-',
        'font': 'korean',
        'transparent_background': True,
    })
    assert options.end == 10
    assert options.prefix == '입장권-'
    assert options.font == 'korean'
    assert options.transparent_background is True
    assert format_number(7, 'pad3', options.prefix) == '입장권-007'


@pytest.mark.parametrize('font', [
    'korean',
    'helvetica', 'helvetica-bold', 'helvetica-oblique', 'helvetica-bold-oblique',
    'times', 'times-bold', 'times-italic', 'times-bold-italic',
    'courier', 'courier-bold', 'courier-oblique', 'courier-bold-oblique',
])
def test_all_numbering_font_choices_render_without_external_font_files(font):
    source = _source()
    try:
        plan = _auto_plan()
        plan = expand_layout_for_numbering(plan, {'enabled': True, 'start': 1, 'end': 1})
        base = render_layout_pdf([source], plan, gap_mm=3.0, crop_marks=False)
        prefix = '표-' if font == 'korean' else 'T-'
        numbered = apply_layout_numbering(base, plan, {
            'enabled': True,
            'start': 1,
            'end': 1,
            'prefix': prefix,
            'font': font,
            'format': 'pad3',
            'transparent_background': True,
        })
        output = fitz.open(stream=numbered, filetype='pdf')
        try:
            text = output[0].get_text()
            assert '001' in text
        finally:
            output.close()
    finally:
        source.close()
