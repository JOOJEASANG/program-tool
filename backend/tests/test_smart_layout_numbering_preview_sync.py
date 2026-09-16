from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_numbering_preview_sync_is_loaded_after_final_controls():
    html = (ROOT / 'smart-print-layout' / 'index.html').read_text(encoding='utf-8')
    final_marker = '/js/smart-print-layout/final-controls.js?v=20260916-1'
    sync_marker = '/js/smart-print-layout/numbering-preview-sync.js?v=20260916-2'
    duplex_marker = '/js/smart-print-layout/duplex-preview.js?v=20260916-1'
    assert final_marker in html
    assert sync_marker in html
    assert duplex_marker in html
    assert html.index(final_marker) < html.index(sync_marker) < html.index(duplex_marker)


def test_numbering_preview_sync_uses_offsets_fixed_font_bold_color_and_no_margins():
    module = (ROOT / 'js' / 'smart-print-layout' / 'numbering-preview-sync.js').read_text(encoding='utf-8')
    for marker in (
        'numberingOffsetX',
        'numberingOffsetY',
        'numberingTargetSide',
        'numberingBold',
        'numberingColor',
        '굵게 표시',
        '글씨 색상',
        '앞면만',
        '뒷면만',
        '앞·뒷면 모두',
        "`${prefix} ${number}`",
        'KOREAN_STACK',
        "config.font = 'korean'",
        "config.bold = Boolean($('numberingBold')?.checked)",
        'config.color = colorValue()',
        'delete config.margin_x_mm',
        'delete config.margin_y_mm',
        'removeLegacyMarginControls',
        "smartLayoutNumberingPreviewSync = 'v5-position-side-bold-color-no-margins'",
    ):
        assert marker in module

    assert '한국어 기본 (고정)' in module
    assert "element.style.fontWeight = bold ? '700' : '400'" in module
    assert 'element.style.color = color' in module


def test_saved_pdf_numbering_forces_korean_font_supports_bold_color_and_no_margin_options():
    service = (ROOT / 'backend' / 'services' / 'smart_print_numbering.py').read_text(encoding='utf-8')
    assert "_NUMBERING_FONT_KEY = 'korean'" in service
    assert "_NUMBERING_FONT_NAME = 'korea'" in service
    assert "_NUMBERING_INSET_MM = 1.6" in service
    assert "f'{normalized_prefix} {number}'" in service
    assert 'bold: bool = False' in service
    assert "color: str = _DEFAULT_COLOR" in service
    assert "render_mode': 2" in service
    assert "border_width': 0.28" in service
    assert 'margin_x_mm:' not in service
    assert 'margin_y_mm:' not in service
    assert "_ALLOWED_TARGET_SIDES = {'front', 'back', 'both'}" in service
    assert 'offset_x_mm' in service and 'offset_y_mm' in service
