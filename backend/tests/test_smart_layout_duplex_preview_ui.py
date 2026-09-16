from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_duplex_preview_module_keeps_single_preview_and_adds_side_by_side_mode_only_for_duplex():
    module = (ROOT / 'js' / 'smart-print-layout' / 'duplex-preview.js').read_text(encoding='utf-8')
    for marker in (
        "if (!plan?.duplex || !plan.sheets?.length)",
        "elements.shell.classList.add('duplex-preview-active')",
        "drawSide(elements.front, 'front', size)",
        "drawSide(elements.back, 'back', size)",
        "api.state.side = 'front'",
        "frontLabel.textContent = '앞면'",
        "backLabel.textContent = '뒷면'",
        "preview-controls.duplex-preview-mode",
        "document.documentElement.dataset.smartLayoutDuplexPreview = 'v1-side-by-side'",
    ):
        assert marker in module

    # The existing front canvas remains the single-sided preview surface.
    assert "const front = $('layoutCanvas')" in module
    assert "elements.back.style.display = 'none'" in module
    assert "elements.shell.classList.remove('duplex-preview-active')" in module


def test_duplex_preview_back_side_mirrors_layout_and_reuses_numbering_trim_settings():
    module = (ROOT / 'js' / 'smart-print-layout' / 'duplex-preview.js').read_text(encoding='utf-8')
    for marker in (
        'function mirrorBack',
        "const placement = side === 'back' ? mirrorBack(frontPlacement, plan.cfg) : frontPlacement",
        "const thumb = side === 'back' ? item.backThumb : item.frontThumb",
        "SmartPrintLayoutEnhancements?.numberingConfig?.()",
        "SmartPrintLayoutEnhancements?.trimGuideConfig?.()",
        "const targetSide = config.target_side || 'both'",
        "targetSide !== 'both' && targetSide !== 'back'",
        'offset_x_mm',
        'offset_y_mm',
        'drawTrimGuide',
        "return prefix ? `${prefix} ${number}` : number",
        'KOREAN_STACK',
        "element.style.fontWeight = '400'",
    ):
        assert marker in module


def test_duplex_preview_script_is_loaded_after_numbering_sync_before_session_restore():
    html = (ROOT / 'smart-print-layout' / 'index.html').read_text(encoding='utf-8')
    numbering = '/js/smart-print-layout/numbering-preview-sync.js?v=20260916-2'
    duplex = '/js/smart-print-layout/duplex-preview.js?v=20260916-1'
    session = '/js/smart-print-layout/session-persistence.js?v=20260910-1'
    assert numbering in html and duplex in html and session in html
    assert html.index(numbering) < html.index(duplex) < html.index(session)
    assert '단면은 기존처럼 한 장으로, 양면은 앞면과 뒷면을 좌우에 동시에 표시합니다.' in html
