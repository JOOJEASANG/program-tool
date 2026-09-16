from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_required_trim_is_static_step3_and_front_back_is_step4():
    html = (ROOT / 'smart-print-layout' / 'index.html').read_text(encoding='utf-8')

    trim_heading = '<h2>재단크기 입력/비교</h2>'
    front_heading = '<h2>앞면 · 뒷면</h2>'
    assert trim_heading in html
    assert front_heading in html
    assert html.index(trim_heading) < html.index(front_heading)
    assert '<div class="step">STEP 3</div>\n        <h2>재단크기 입력/비교</h2>' in html
    assert '<div class="step">STEP 4</div>\n        <h2>앞면 · 뒷면</h2>' in html
    assert 'id="trimGuideWidth"' in html and 'required aria-required="true"' in html
    assert 'id="trimGuideHeight"' in html and 'required aria-required="true"' in html
    assert '입력한 재단크기로 완성 PDF에 재단표시 추가' in html


def test_final_controls_load_after_legacy_advanced_controls_and_restore_new_numbering():
    html = (ROOT / 'smart-print-layout' / 'index.html').read_text(encoding='utf-8')
    final_controls = (ROOT / 'js' / 'smart-print-layout' / 'final-controls.js').read_text(encoding='utf-8')

    advanced_src = '/js/smart-print-layout/advanced-controls.js?v=20260915-1'
    final_src = '/js/smart-print-layout/final-controls.js?v=20260916-1'
    assert advanced_src in html and final_src in html
    assert html.index(advanced_src) < html.index(final_src)

    for marker in (
        "legacy.hidden = true",
        "legacyEnabled.checked = false",
        'id="numberingEnd"',
        'id="numberingPrefix"',
        'id="numberingTransparent"',
        "settings.trim_width_mm = trim.widthMm",
        "settings.trim_height_mm = trim.heightMm",
        "settings.numbering = validateNumberingConfig(numberingConfig())",
        "dataset.smartPrintFinalControls = 'required-trim-v1'",
    ):
        assert marker in final_controls


def test_server_replaces_legacy_page_edge_crop_marks_with_entered_trim_marks():
    router = (ROOT / 'backend' / 'routers' / 'pdf_smart_layout.py').read_text(encoding='utf-8')
    trim_service = (ROOT / 'backend' / 'services' / 'smart_print_trim.py').read_text(encoding='utf-8')

    assert 'crop_marks=False' in router
    assert 'apply_trim_crop_marks(' in router
    assert 'required=settings.crop_marks' in router
    assert 'trim_rect_mm' in trim_service
    assert 'placement.rotated' in trim_service
