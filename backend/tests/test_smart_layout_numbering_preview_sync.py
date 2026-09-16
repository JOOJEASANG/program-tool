from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_numbering_preview_sync_is_loaded_after_final_controls():
    html = (ROOT / 'smart-print-layout' / 'index.html').read_text(encoding='utf-8')
    final_marker = '/js/smart-print-layout/final-controls.js?v=20260916-1'
    sync_marker = '/js/smart-print-layout/numbering-preview-sync.js?v=20260916-1'
    assert final_marker in html
    assert sync_marker in html
    assert html.index(final_marker) < html.index(sync_marker)


def test_numbering_preview_sync_uses_true_xy_offsets_compact_prefix_and_side_selector():
    module = (ROOT / 'js' / 'smart-print-layout' / 'numbering-preview-sync.js').read_text(encoding='utf-8')
    for marker in (
        'numberingOffsetX',
        'numberingOffsetY',
        'numberingTargetSide',
        '앞면만',
        '뒷면만',
        '앞·뒷면 모두',
        "position === 'top-left'",
        "position === 'bottom-center'",
        "`${prefix}${number}`",
        'KOREAN_STACK',
        "smartLayoutNumberingPreviewSync = 'v3-position-offset-side-font-safe'",
    ):
        assert marker in module
    assert 'numbering-prefix-format-row' in module
    assert 'column-gap:16px!important' in module
    assert '`${prefix} ${number}`' not in module


def test_saved_pdf_numbering_auto_falls_back_to_korean_font_without_forced_space():
    service = (ROOT / 'backend' / 'services' / 'smart_print_numbering.py').read_text(encoding='utf-8')
    assert 'def _contains_korean' in service
    assert "return 'korea'" in service
    assert 'normalized_prefix' in service
    assert "f'{normalized_prefix}{number}'" in service
    assert "_ALLOWED_TARGET_SIDES = {'front', 'back', 'both'}" in service
    assert 'offset_x_mm' in service and 'offset_y_mm' in service
