from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_direct_print_buttons_are_retired_for_all_programs():
    build = read("scripts/prepare_hosting_dist.py")
    retired = read("js/direct-print.js")

    # Hosting no longer injects extra printer actions beside the normal
    # downloaded-PDF/export buttons of the five supported editor programs.
    assert "DIRECT_PRINT_TARGETS" not in build
    assert "DIRECT_PRINT_SNIPPET" not in build
    assert "data-program-studio-direct-print" not in build
    assert '/js/direct-print.js?v=' not in build

    # Older cached pages may still load the original asset path: the asset
    # must not reconstruct a print button or trigger a browser print dialog.
    assert "removeLegacyPrintButtons" in retired
    assert "querySelectorAll('.program-direct-print-btn')" in retired
    assert "source.insertAdjacentElement" not in retired
    assert "target.print()" not in retired

    for path in (
        "smart-print-layout/index.html",
        "pdf-editor/index.html",
        "pdf-editor-advanced/index.html",
        "ai-design-maker/index.html",
        "tools/pdf-editor.html",
    ):
        assert "data-program-studio-direct-print" not in read(path)
    assert 'id="downloadBtn"' in read("smart-print-layout/index.html")
    assert 'id="exportBtn"' in read("ai-design-maker/index.html")


def test_advanced_editor_reset_keeps_loaded_pdf_and_resets_edits():
    facing = read("js/pdf-editor-advanced/facing-upload.js")
    reset = read("js/pdf-editor-advanced/workspace-reset.js")

    assert "import './workspace-reset.js?v=20261027-2';" in facing
    assert "advancedWorkspaceResetBtn" in reset
    assert "편집 초기화" in reset
    assert "불러온 PDF는 그대로 두고" in reset
    assert "page.eraseRegions = []" in reset
    assert "page.overlays = []" in reset
    assert "page.scale = 1" in reset
    assert "page.offsetX = 0" in reset
    assert "page.offsetY = 0" in reset
    assert "preset: 'original'" in reset
    assert "cropMarks: false" in reset
    assert "clearHistory()" in reset
    assert "emitStateChange('workspace-reset')" in reset

    # Reset must preserve the currently loaded PDF files/documents/pages.
    assert "resetAllState" not in reset
    assert "advancedState.files = []" not in reset
    assert "advancedState.documents = []" not in reset
    assert "advancedState.pages = []" not in reset
