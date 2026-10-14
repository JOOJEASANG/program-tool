import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "js" / "pdf-editor" / "core-runtime.js"
REPEAT = ROOT / "js" / "pdf-editor" / "nup-repeat.js"


def test_lightweight_pdf_editor_loads_same_page_repeat_module():
    runtime = RUNTIME.read_text(encoding="utf-8")

    assert "function loadNupRepeat()" in runtime
    assert "/js/pdf-editor/nup-repeat.js?v=20261014-4" in runtime
    assert ".then(()=>advanced?loadAdvancedRuntime():loadNupRepeat())" in runtime


def test_repeat_supports_only_two_or_four_copies_per_sheet():
    source = REPEAT.read_text(encoding="utf-8")

    for marker in (
        "title.textContent = '반복배치'",
        "const VALID_REPEAT_COUNTS = new Set([2, 4]);",
        "setEnabled(false, { schedule: false });",
        "controls.setAttribute('aria-label', '반복배치 개수')",
        "button.dataset.repeatCount = String(count)",
        "function repeatLayoutN(count = selectedRepeatCount())",
        "return normalizeRepeatCount(count) <= 2 ? 2 : 4;",
        "pages: Array.from({ length: count }, () => page)",
        "nup_override: layoutN",
        "nup_disabled: false",
        "group_break: index === 0",
        "state.repeatSamePageCount = selectedRepeatCount();",
        "repeatCount = normalizeRepeatCount(saved?.repeatSamePageCount || repeatCount);",
        "pdfNupSamePageRepeatMode = 'two-four-buttons-v3'",
        "stage: 'pdf-editor-nup-repeat-v3-two-four-buttons'",
    ):
        assert marker in source

    assert "[2, 4].forEach(count =>" in source
    assert "count === 3 ? 4 : 2" in source
    assert "readPreference()" not in source
    assert "next.repeat_cell_overlays || !isEnabled() || next.booklet" in source


def test_same_page_repeat_reuses_existing_layout_for_every_paper_size():
    source = REPEAT.read_text(encoding="utf-8")

    for marker in (
        "originalGroupByNup.apply(this, args)",
        "MAX_API_PAGES = 2000",
        "originalApiProcessPdf.call(this, files, expandSettingsPages(settings), options)",
        "next.nup_default = layoutN",
        "next.booklet = false",
    ):
        assert marker in source

    # Paper dimensions stay owned by the existing PDF editor layout engine.
    # A4/A3/B4/B5/Letter/custom and portrait/landscape therefore use the same
    # repeat implementation without size-specific branches here.
    assert "210" not in source
    assert "297" not in source
    assert "paperSize" not in source


def test_repeat_two_four_ui_and_session_restore_behavior():
    result = subprocess.run(
        ["node", str(ROOT / "backend/tests/test_pdf_repeat_two_four_ui_behavior.cjs")],
        cwd=ROOT, capture_output=True, text=True, check=False, timeout=30,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf repeat two-four UI behavior passed" in result.stdout
