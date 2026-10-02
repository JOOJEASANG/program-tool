from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "js" / "pdf-editor" / "core-runtime.js"
REPEAT = ROOT / "js" / "pdf-editor" / "nup-repeat.js"


def test_lightweight_pdf_editor_loads_same_page_repeat_module():
    runtime = RUNTIME.read_text(encoding="utf-8")

    assert "function loadNupRepeat()" in runtime
    assert "/js/pdf-editor/nup-repeat.js?v=20261002-2" in runtime
    assert ".then(()=>advanced?loadAdvancedRuntime():loadNupRepeat())" in runtime


def test_same_page_repeat_supports_two_three_or_four_copies_per_sheet():
    source = REPEAT.read_text(encoding="utf-8")

    for marker in (
        "같은 페이지 반복 배치",
        "반복 개수",
        "const VALID_REPEAT_COUNTS = new Set([2, 3, 4]);",
        "function repeatLayoutN(count = selectedRepeatCount())",
        "return normalizeRepeatCount(count) <= 2 ? 2 : 4;",
        "pages: Array.from({ length: count }, () => page)",
        "nup_override: layoutN",
        "nup_disabled: false",
        "group_break: index === 0",
        "state.repeatSamePageCount = selectedRepeatCount();",
        "repeatCount = normalizeRepeatCount(saved?.repeatSamePageCount || repeatCount);",
        "pdfNupSamePageRepeatMode = 'max4-v2'",
        "stage: 'pdf-editor-nup-repeat-v2-max4'",
    ):
        assert marker in source

    assert "[2, 3, 4].forEach(count =>" in source
    assert "3개 반복: 2×2 배치의 한 칸은 비워 둡니다." in source


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
