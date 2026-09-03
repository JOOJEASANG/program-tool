from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_pdf_shell_has_one_ui_loader_and_manifest_owns_the_always_visible_sidebar():
    shell = text("js/program-shell-unify.js")
    runtime = text("js/pdf-editor/ui-runtime.js")

    assert "/js/pdf-editor/ui-runtime.js?v=${PDF_UI_RUNTIME_VERSION}" in shell
    assert "PDF_UI_RUNTIME_VERSION='20260831-1'" in shell
    assert "pdf-editor-always-visible-sidebar-runtime-v2" in shell
    assert "pdf-editor-always-visible-sidebar-runtime-v2" in runtime
    assert "/js/pdf-editor/simple-sidebar-ui.js?v=20260831-1" in runtime
    assert "/js/pdf-editor/workflow-ui.js" not in runtime
    assert "/js/pdf-editor/workspace-layout.js" not in runtime
    assert runtime.count("{id:") == 1


