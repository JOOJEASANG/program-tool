from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_latest_numbering_ui_assets_and_copy_are_ready_for_production():
    html = (ROOT / 'smart-print-layout' / 'index.html').read_text(encoding='utf-8')
    polish = (ROOT / 'js' / 'smart-print-layout' / 'numbering-ui-polish.js').read_text(encoding='utf-8')
    sync = (ROOT / 'js' / 'smart-print-layout' / 'numbering-preview-sync.js').read_text(encoding='utf-8')
    backend = (ROOT / 'backend' / 'services' / 'smart_print_numbering.py').read_text(encoding='utf-8')

    assert '/js/smart-print-layout/numbering-preview-sync.js?v=20260916-4' in html
    assert '/js/smart-print-layout/numbering-ui-polish.js?v=20260916-2' in html
    assert '단면과 양면 모두 같은 크기의 중앙 미리보기를 사용합니다.' not in html

    assert '마우스 휠로 조절할 수 있습니다.' in polish
    assert '#numberingPrefix:focus{box-shadow:none!important}' in polish
    assert "bindWheelControl($('numberingOffsetX'))" in polish
    assert "bindWheelControl($('numberingOffsetY'))" in polish

    for marker in ('korean-sans', 'korean-serif', 'helvetica', 'times', 'courier'):
        assert marker in sync
        assert marker in backend

    assert '_NUMBERING_FONT_MAP' in backend
    assert '_contains_extended_text' in backend
