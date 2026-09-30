from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_direct_print_is_injected_into_supported_hosting_apps():
    build = read("scripts/prepare_hosting_dist.py")
    direct_print = read("js/direct-print.js")

    for target in (
        "smart-print-layout/index.html",
        "pdf-editor/index.html",
        "pdf-editor-advanced/index.html",
        "ai-design-maker/index.html",
        "tools/pdf-editor.html",
    ):
        assert target in build

    assert "data-program-studio-direct-print" in build
    assert '/js/direct-print.js?v=20260930-2' in build
    assert "program-direct-print-btn" in direct_print
    assert "프린터 출력" in direct_print
    assert "target.print()" in direct_print
    for route_marker in (
        "smart-print-layout",
        "pdf-editor-advanced",
        "pdf-editor",
        "tools\\/pdf-editor",
        "ai-design-maker",
    ):
        assert route_marker in direct_print


def test_advanced_editor_reset_keeps_loaded_pdf_and_resets_edits():
    facing = read("js/pdf-editor-advanced/facing-upload.js")
    reset = read("js/pdf-editor-advanced/workspace-reset.js")

    assert "import './workspace-reset.js';" in facing
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
