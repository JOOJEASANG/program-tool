from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_numbering_preview_sync_is_loaded_after_final_controls():
    html = (ROOT / 'smart-print-layout' / 'index.html').read_text(encoding='utf-8')
    final_marker = '/js/smart-print-layout/final-controls.js?v=20260916-1'
    sync_marker = '/js/smart-print-layout/numbering-preview-sync.js?v=20260916-4'
    polish_marker = '/js/smart-print-layout/numbering-ui-polish.js?v=20260916-2'
    duplex_marker = '/js/smart-print-layout/duplex-preview.js?v=20260916-2'
    assert final_marker in html
    assert sync_marker in html
    assert polish_marker in html
    assert duplex_marker in html
    assert html.index(final_marker) < html.index(sync_marker) < html.index(polish_marker) < html.index(duplex_marker)


def test_numbering_preview_sync_uses_offsets_selectable_fonts_bold_color_and_no_margins():
    module = (ROOT / 'js' / 'smart-print-layout' / 'numbering-preview-sync.js').read_text(encoding='utf-8')
    for marker in (
        'numberingOffsetX',
        'numberingOffsetY',
        'numberingTargetSide',
        'numberingBold',
        'numberingColor',
        'numberingFont',
        '굵게 표시',
        '글씨 색상',
        '앞면만',
        '뒷면만',
        '앞·뒷면 모두',
        "`${prefix} ${number}`",
        "value: 'korean-sans'",
        "value: 'korean-serif'",
        "value: 'helvetica'",
        "value: 'times'",
        "value: 'courier'",
        '한국어 고딕 · 돋움 (권장)',
        '한국어 명조 · 바탕',
        'config.font = fontValue()',
        'settings.numbering.font = fontValue()',
        "config.bold = Boolean($('numberingBold')?.checked)",
        'config.color = colorValue()',
        'delete config.margin_x_mm',
        'delete config.margin_y_mm',
        'removeLegacyMarginControls',
        "smartLayoutNumberingPreviewSync = 'v6-selectable-pdf-safe-fonts-position-side-bold-color-no-margins'",
    ):
        assert marker in module

    assert '한국어 기본 (고정)' not in module
    assert "element.style.fontFamily = family" in module
    assert "element.style.fontWeight = bold ? '700' : '400'" in module
    assert 'element.style.color = color' in module


def test_saved_pdf_numbering_supports_safe_font_map_and_korean_fallback():
    service = (ROOT / 'backend' / 'services' / 'smart_print_numbering.py').read_text(encoding='utf-8')
    for marker in (
        "_DEFAULT_NUMBERING_FONT_KEY = 'korean-sans'",
        "'korean-sans': 'korea'",
        "'korean-serif': 'korea-s'",
        "'helvetica': 'helv'",
        "'times': 'tiro'",
        "'courier': 'cour'",
        '_contains_extended_text',
        "return 'korea-s'",
        "return 'korea'",
        "_NUMBERING_INSET_MM = 1.6",
        "f'{normalized_prefix} {number}'",
        'bold: bool = False',
        "color: str = _DEFAULT_COLOR",
        "render_mode': 2",
        "border_width': 0.28",
        "_ALLOWED_TARGET_SIDES = {'front', 'back', 'both'}",
        'offset_x_mm',
        'offset_y_mm',
    ):
        assert marker in service

    assert 'margin_x_mm:' not in service
    assert 'margin_y_mm:' not in service
