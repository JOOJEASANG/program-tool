from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_duplex_preview_uses_one_center_canvas_and_native_side_buttons():
    module = (ROOT / 'js' / 'smart-print-layout' / 'duplex-preview.js').read_text(encoding='utf-8')
    for marker in (
        "document.querySelector('.preview-controls')?.classList.remove('duplex-preview-mode')",
        "['layoutCanvasBack', 'duplexBackOverlay', 'duplexFrontLabel', 'duplexBackLabel']",
        "back.disabled = !plan?.duplex",
        "document.documentElement.dataset.smartLayoutDuplexPreview = 'v2-selected-side-centered'",
        '앞면·뒷면 버튼으로 선택해 확인',
    ):
        assert marker in module

    assert "elements.shell.classList.add('duplex-preview-active')" not in module
    assert "drawSide(elements.front, 'front', size)" not in module
    assert "drawSide(elements.back, 'back', size)" not in module


def test_default_paper_is_applied_as_a4_before_session_restore_can_override_it():
    module = (ROOT / 'js' / 'smart-print-layout' / 'duplex-preview.js').read_text(encoding='utf-8')
    for marker in (
        "preset.value = 'a4'",
        "width.value = '210'",
        "height.value = '297'",
        "preset.dispatchEvent(new Event('change', { bubbles: true }))",
        "smartLayoutA4DefaultApplied",
    ):
        assert marker in module


def test_selection_mode_keeps_existing_single_canvas_trim_and_numbering_overlay_path():
    module = (ROOT / 'js' / 'smart-print-layout' / 'duplex-preview.js').read_text(encoding='utf-8')
    size_module = (ROOT / 'js' / 'smart-print-layout' / 'size-numbering.js').read_text(encoding='utf-8')
    app = (ROOT / 'js' / 'smart-print-layout' / 'app.js').read_text(encoding='utf-8')

    assert "window.SmartPrintLayoutEnhancements?.scheduleOverlay?.()" in module
    assert "const canvas = $('layoutCanvas')" in size_module
    assert "overlay.style.width = `${canvas.clientWidth}px`" in size_module
    assert "$('frontBtn').onclick" in app
    assert "$('backBtn').onclick" in app
    assert "state.side = 'back'" in app
