from pathlib import Path

import fitz

from models.smart_layout_schemas import SmartLayoutRequest
from routers.pdf_smart_layout import _prepare_separate_back_files
from services.smart_print_layout import inspect_sources, render_layout_pdf
from services.smart_print_layout_auto import build_auto_fill_layout_plan
from services.smart_print_numbering import parse_numbering_options


ROOT = Path(__file__).resolve().parents[2]
MM_TO_PT = 72.0 / 25.4


def _one_page(text: str, width_mm=90.0, height_mm=50.0):
    doc = fitz.open()
    page = doc.new_page(width=width_mm * MM_TO_PT, height=height_mm * MM_TO_PT)
    page.insert_text((12, 22), text)
    return doc


def test_separate_one_page_files_become_one_duplex_layout_source():
    front = _one_page('FRONT-FILE')
    back = _one_page('BACK-FILE')
    combined = []
    try:
        settings = SmartLayoutRequest.model_validate({
            'jobs': [{'file_index': 0, 'back_file_index': 1, 'quantity': 1}],
            'paper': {'width_mm': 210, 'height_mm': 297},
            'auto_fill': True,
            'side_mode': 'auto',
            'flip_edge': 'long',
        })
        render_docs, combined = _prepare_separate_back_files(
            [front, back], settings.jobs, ['front.pdf', 'back.pdf']
        )
        items, duplex = inspect_sources(render_docs, settings.jobs, ['front.pdf', 'back.pdf'], settings.side_mode)
        assert duplex is True
        assert len(items) == 1
        assert items[0].page_count == 2

        plan = build_auto_fill_layout_plan(
            items, 210, 297, 5, 3, False, duplex, 'long'
        )
        output_bytes = render_layout_pdf(render_docs, plan, gap_mm=3, crop_marks=False)
        output = fitz.open(stream=output_bytes, filetype='pdf')
        try:
            assert output.page_count == 2
            assert 'FRONT-FILE' in output[0].get_text()
            assert 'BACK-FILE' in output[1].get_text()
        finally:
            output.close()
    finally:
        for doc in combined:
            doc.close()
        front.close()
        back.close()


def test_separate_back_file_must_match_front_size():
    front = _one_page('FRONT', 90, 50)
    back = _one_page('BACK', 91.5, 50)
    try:
        settings = SmartLayoutRequest.model_validate({
            'jobs': [{'file_index': 0, 'back_file_index': 1}],
        })
        render_docs = []
        try:
            _prepare_separate_back_files([front, back], settings.jobs, ['front.pdf', 'back.pdf'])
        except ValueError as exc:
            assert '크기가 앞면과 다릅니다' in str(exc)
        else:
            raise AssertionError('mismatched duplex source size should be rejected')
    finally:
        front.close()
        back.close()


def test_job_schema_rejects_back_file_reused_as_front_job():
    try:
        SmartLayoutRequest.model_validate({
            'jobs': [
                {'file_index': 0, 'back_file_index': 1},
                {'file_index': 1},
            ]
        })
    except ValueError as exc:
        assert '앞면 작업과 다른 작업의 뒷면' in str(exc)
    else:
        raise AssertionError('back file must not also become a front layout job')


def test_numbering_preserves_supported_font_aliases_ignores_legacy_margins_and_keeps_offsets_appearance():
    expected_fonts = {
        'helvetica': 'helvetica',
        'helvetica-bold': 'helvetica',
        'times': 'times',
        'courier': 'courier',
    }
    for legacy_font, expected_font in expected_fonts.items():
        options = parse_numbering_options({
            'enabled': True,
            'font': legacy_font,
            'position': 'top-center',
            'font_size_pt': 10,
            'margin_x_mm': 35,
            'margin_y_mm': 40,
            'offset_x_mm': 3.5,
            'offset_y_mm': -4.0,
            'bold': True,
            'color': '#0f766e',
        })
        assert options.font == expected_font
        assert options.position == 'top-center'
        assert options.offset_x_mm == 3.5
        assert options.offset_y_mm == -4.0
        assert options.bold is True
        assert options.color == '#0f766e'
        assert not hasattr(options, 'margin_x_mm')
        assert not hasattr(options, 'margin_y_mm')


def test_frontend_exposes_orientation_duplex_pairing_and_final_numbering_controls():
    html = (ROOT / 'smart-print-layout' / 'index.html').read_text(encoding='utf-8')
    module = (ROOT / 'js' / 'smart-print-layout' / 'advanced-controls.js').read_text(encoding='utf-8')
    sync = (ROOT / 'js' / 'smart-print-layout' / 'numbering-preview-sync.js').read_text(encoding='utf-8')
    preview = (ROOT / 'js' / 'smart-print-layout' / 'duplex-preview.js').read_text(encoding='utf-8')

    assert '/js/smart-print-layout/advanced-controls.js?v=20260915-1' in html
    assert 'guide-row' not in html
    for marker in (
        'paperOrientation',
        '세로 출력',
        '가로 출력',
        '뒷면으로 사용',
        'back_file_index',
        'settings.numbering = numberingConfig()',
        "stage: 'smart-print-orientation-duplex-numbering-preview-v2'",
    ):
        assert marker in module

    # Legacy compatibility controls can remain in the hidden module, but the
    # final sync removes old margins and owns the visible/exported font options.
    assert "config.font = fontValue()" in sync
    assert "settings.numbering.font = fontValue()" in sync
    assert "const DEFAULT_FONT = 'korean-sans'" in sync
    for marker in ('korean-sans', 'korean-serif', 'helvetica', 'times', 'courier'):
        assert marker in sync
    assert '한국어 기본 (고정)' not in sync
    assert 'removeLegacyMarginControls' in sync
    assert 'numberingBold' in sync and 'numberingColor' in sync
    assert "return prefix ? `${prefix} ${number}` : number;" in sync
    assert "preset.value = 'a4'" in preview
    assert "smartLayoutDuplexPreview = 'v2-selected-side-centered'" in preview
    assert '.canvas-shell{flex:1;min-height:0;padding:12px;overflow:hidden}' in module
    assert 'requestFitCanvas' in module
