from pathlib import Path

import fitz
import pytest

from services.smart_print_layout import SourceItem, build_layout_plan, render_layout_pdf
from services.smart_print_numbering import apply_layout_numbering, parse_numbering_options


ROOT = Path(__file__).resolve().parents[2]
MM_TO_PT = 72.0 / 25.4


def _duplex_source(width_mm=90.0, height_mm=50.0):
    doc = fitz.open()
    front = doc.new_page(width=width_mm * MM_TO_PT, height=height_mm * MM_TO_PT)
    front.insert_text((12, 22), 'FRONT')
    back = doc.new_page(width=width_mm * MM_TO_PT, height=height_mm * MM_TO_PT)
    back.insert_text((12, 22), 'BACK')
    return doc


def test_numbering_is_printed_sequentially_and_matches_front_back():
    source = _duplex_source()
    try:
        item = SourceItem(0, 'card.pdf', 90.0, 50.0, 2, 2)
        plan = build_layout_plan([item], 210.0, 297.0, 5.0, 3.0, True, True, 'long')
        base = render_layout_pdf([source], plan, gap_mm=3.0, crop_marks=False)
        numbered = apply_layout_numbering(base, plan, {
            'enabled': True,
            'start': 7,
            'format': 'pad3',
            'position': 'bottom-right',
            'font_size_pt': 9,
        })
        output = fitz.open(stream=numbered, filetype='pdf')
        try:
            assert output.page_count == 2
            front_text = output[0].get_text()
            back_text = output[1].get_text()
            assert '007' in front_text and '008' in front_text
            assert '007' in back_text and '008' in back_text
        finally:
            output.close()
    finally:
        source.close()


def test_numbering_disabled_leaves_pdf_bytes_untouched():
    source = _duplex_source()
    try:
        item = SourceItem(0, 'card.pdf', 90.0, 50.0, 2, 1)
        plan = build_layout_plan([item], 210.0, 297.0, 5.0, 3.0, False, True, 'long')
        base = render_layout_pdf([source], plan, gap_mm=3.0, crop_marks=False)
        assert apply_layout_numbering(base, plan, {'enabled': False}) is base
    finally:
        source.close()


def test_numbering_settings_reject_out_of_range_values():
    with pytest.raises(ValueError):
        parse_numbering_options({'enabled': True, 'start': -1})
    with pytest.raises(ValueError):
        parse_numbering_options({'enabled': True, 'font_size_pt': 50})
    with pytest.raises(ValueError):
        parse_numbering_options({'enabled': True, 'position': 'center'})


def test_smart_layout_frontend_keeps_image_size_isolated_and_numbering_optional():
    html = (ROOT / 'smart-print-layout' / 'index.html').read_text(encoding='utf-8')
    module = (ROOT / 'js' / 'smart-print-layout' / 'size-numbering.js').read_text(encoding='utf-8')
    core = (ROOT / 'js' / 'smart-print-layout' / 'app.js').read_text(encoding='utf-8')
    router = (ROOT / 'backend' / 'routers' / 'pdf_smart_layout.py').read_text(encoding='utf-8')

    assert '/js/smart-print-layout/size-numbering.js?v=20260915-1' in html
    assert html.index('size-numbering.js?v=20260915-1') < html.index('image-input-bridge.js?v=20260915-2')
    for marker in (
        '이미지 인쇄 크기',
        '비율 고정',
        'item.widthMm = widthMm',
        'item.heightMm = heightMm',
        'pdf.addImage(jpeg, \'JPEG\', 0, 0, widthMm, heightMm',
        'numberingEnabled',
        'numberingPosition',
        'numberingFontSize',
        "numbering: numberingConfig()",
        "stage: 'smart-layout-image-direct-size-numbering-v1'",
    ):
        assert marker in module

    # The established packing engine remains owned by app.js. The extension
    # only changes image source PDFs and the optional numbered output path.
    assert 'function packOneFile' in core
    assert 'auto-fill-centered-v2' in core
    assert 'apply_layout_numbering' in router
    assert "raw_settings.get('numbering')" in router
