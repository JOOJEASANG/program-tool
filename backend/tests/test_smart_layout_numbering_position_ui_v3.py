from pathlib import Path

import fitz
import pytest

from services.smart_print_layout import SourceItem, render_layout_pdf
from services.smart_print_layout_auto import build_auto_fill_layout_plan
from services.smart_print_numbering import apply_layout_numbering, parse_numbering_options


ROOT = Path(__file__).resolve().parents[2]
MM_TO_PT = 72.0 / 25.4


def _source():
    doc = fitz.open()
    page = doc.new_page(width=90 * MM_TO_PT, height=50 * MM_TO_PT)
    page.insert_text((12, 22), 'SOURCE')
    return doc


def _plan():
    item = SourceItem(0, 'ticket.pdf', 90.0, 50.0, 1, 1)
    return build_auto_fill_layout_plan([item], 210.0, 297.0, 5.0, 3.0, True, False, 'long')


def test_numbering_xy_offsets_are_validated():
    options = parse_numbering_options({
        'enabled': True,
        'offset_x_mm': -12.5,
        'offset_y_mm': 8.0,
    })
    assert options.offset_x_mm == -12.5
    assert options.offset_y_mm == 8.0
    with pytest.raises(ValueError, match='-50~50mm'):
        parse_numbering_options({'enabled': True, 'offset_x_mm': 50.5})


def test_numbering_font_choices_and_legacy_aliases_are_normalized():
    assert parse_numbering_options({'enabled': True, 'font': 'korean-sans'}).font == 'korean-sans'
    assert parse_numbering_options({'enabled': True, 'font': 'korean-serif'}).font == 'korean-serif'
    assert parse_numbering_options({'enabled': True, 'font': 'helvetica'}).font == 'helvetica'
    assert parse_numbering_options({'enabled': True, 'font': 'times'}).font == 'times'
    assert parse_numbering_options({'enabled': True, 'font': 'courier'}).font == 'courier'
    assert parse_numbering_options({'enabled': True, 'font': 'korean'}).font == 'korean-sans'
    assert parse_numbering_options({'enabled': True, 'font': 'helvetica-bold'}).font == 'helvetica'
    with pytest.raises(ValueError, match='글꼴'):
        parse_numbering_options({'enabled': True, 'font': 'unknown-font'})


def test_center_anchor_xy_offsets_move_saved_pdf_text():
    source = _source()
    try:
        plan = _plan()
        base = render_layout_pdf([source], plan, gap_mm=3.0, crop_marks=False)

        def text_rect(offset_x, offset_y):
            output_bytes = apply_layout_numbering(base, plan, {
                'enabled': True,
                'start': 1,
                'position': 'top-center',
                'offset_x_mm': offset_x,
                'offset_y_mm': offset_y,
                'transparent_background': True,
            })
            output = fitz.open(stream=output_bytes, filetype='pdf')
            try:
                matches = output[0].search_for('001')
                assert matches
                return fitz.Rect(matches[-1])
            finally:
                output.close()

        origin = text_rect(0, 0)
        moved = text_rect(8, 6)
        assert moved.x0 > origin.x0
        assert moved.y0 > origin.y0
    finally:
        source.close()


def test_numbering_ui_uses_one_space_selectable_fonts_and_exposes_side_xy_wheel_controls():
    module = (ROOT / 'js' / 'smart-print-layout' / 'numbering-preview-sync.js').read_text(encoding='utf-8')
    polish = (ROOT / 'js' / 'smart-print-layout' / 'numbering-ui-polish.js').read_text(encoding='utf-8')
    backend = (ROOT / 'backend' / 'services' / 'smart_print_numbering.py').read_text(encoding='utf-8')
    html = (ROOT / 'smart-print-layout' / 'index.html').read_text(encoding='utf-8')

    for marker in (
        'numberingTargetSide',
        '앞면만',
        '뒷면만',
        '앞·뒷면 모두',
        'numberingOffsetX',
        'numberingOffsetY',
        '- 왼쪽 / + 오른쪽',
        '- 위 / + 아래',
        'numbering-prefix-format-row',
        'column-gap:16px!important',
        "config.target_side = $('numberingTargetSide')?.value || 'both'",
        "config.offset_x_mm = numberValue('numberingOffsetX', 0, -50, 50)",
        "config.offset_y_mm = numberValue('numberingOffsetY', 0, -50, 50)",
        "return prefix ? `${prefix} ${number}` : number;",
        'config.font = fontValue()',
        'PDF 저장 호환 글꼴 5종',
    ):
        assert marker in module

    for marker in (
        '넘버링 출력위치는 좌우·상하 입력칸에서 마우스 휠로 조절할 수 있습니다.',
        "input.addEventListener('wheel'",
        "event.preventDefault()",
        '#numberingPrefix:focus{box-shadow:none!important}',
    ):
        assert marker in polish

    assert '단면과 양면 모두 같은 크기의 중앙 미리보기를 사용합니다.' not in html
    assert "return f'{normalized_prefix} {number}' if normalized_prefix else number" in backend
    assert "_DEFAULT_NUMBERING_FONT_KEY = 'korean-sans'" in backend
    assert "_ALLOWED_TARGET_SIDES = {'front', 'back', 'both'}" in backend
    assert 'offset_x_mm' in backend and 'offset_y_mm' in backend
