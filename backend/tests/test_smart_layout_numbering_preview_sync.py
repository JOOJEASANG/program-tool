from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_numbering_preview_sync_is_loaded_after_final_controls():
    html = (ROOT / 'smart-print-layout' / 'index.html').read_text(encoding='utf-8')
    final_marker = '/js/smart-print-layout/final-controls.js?v=20260916-1'
    sync_marker = '/js/smart-print-layout/numbering-preview-sync.js?v=20260916-1'
    assert final_marker in html
    assert sync_marker in html
    assert html.index(final_marker) < html.index(sync_marker)


def test_numbering_preview_sync_uses_final_margin_controls_and_one_space_prefix():
    module = (ROOT / 'js' / 'smart-print-layout' / 'numbering-preview-sync.js').read_text(encoding='utf-8')
    for marker in (
        "numberingMarginX",
        "numberingMarginY",
        "position === 'top-left'",
        "position === 'bottom-center'",
        "`${prefix} ${number}`",
        "KOREAN_STACK",
        "smartLayoutNumberingPreviewSync = 'v1-position-font-safe'",
    ):
        assert marker in module


def test_saved_pdf_numbering_auto_falls_back_to_korean_font():
    service = (ROOT / 'backend' / 'services' / 'smart_print_numbering.py').read_text(encoding='utf-8')
    assert "def _contains_korean" in service
    assert "return 'korea'" in service
    assert "normalized_prefix" in service
    assert "f'{normalized_prefix} {number}'" in service
