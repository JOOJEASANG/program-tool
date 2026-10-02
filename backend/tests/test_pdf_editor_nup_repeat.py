from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "js" / "pdf-editor" / "core-runtime.js"
REPEAT = ROOT / "js" / "pdf-editor" / "nup-repeat.js"


def test_lightweight_pdf_editor_loads_same_page_repeat_module():
    runtime = RUNTIME.read_text(encoding="utf-8")

    assert "function loadNupRepeat()" in runtime
    assert "/js/pdf-editor/nup-repeat.js?v=20261002-1" in runtime
    assert ".then(()=>advanced?loadAdvancedRuntime():loadNupRepeat())" in runtime


def test_same_page_repeat_reuses_existing_nup_layout_for_all_paper_sizes():
    source = REPEAT.read_text(encoding="utf-8")

    for marker in (
        "같은 페이지 반복 배치",
        "Array.from({ length: n }, () => page)",
        "originalGroupByNup.apply(this, args)",
        "page?.nup_override || defaultNup",
        "nup_disabled ? 1",
        "group_break: index === 0",
        "MAX_API_PAGES = 2000",
        "originalApiProcessPdf.call(this, files, expandSettingsPages(settings), options)",
        "repeatSamePage = isEnabled()",
        "pdfNupSamePageRepeat = 'ready-v1'",
    ):
        assert marker in source

    # No paper dimensions are hard-coded: A4/A3/B4/B5/Letter/custom continue
    # through the existing layout engine and only the source-page grouping changes.
    assert "210" not in source
    assert "297" not in source
    assert "paperSize" not in source
