from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_design_shell_has_one_enhancement_loader_and_manifest_owns_modules():
    shell = text("design-editor/index.html")
    runtime = text("js/design-editor/shell-runtime.js")

    assert "/js/design-editor/shell-runtime.js?v=${SHELL_RUNTIME_VERSION}" in shell
    assert "design-shell-runtime-manifest-v1" in shell
    assert "design-shell-runtime-manifest-v1" in runtime

    module_paths = (
        "print-fold-runtime-ensure.js",
        "document-type-state.js",
        "print-product-menu.js",
        "print-product-state-restore.js",
        "print-product-topbar.js",
        "selection-contextbar.js",
        "multi-selection-context.js",
        "multi-selection-smart-guides.js",
        "simple-result-workflow.js",
        "professional-ui.js",
    )
    for path in module_paths:
        assert path in runtime
        assert path not in shell

    assert runtime.count("{id:") == 10
    assert "setInterval(" not in runtime
    assert "eval(" not in runtime


def test_pdf_shell_has_one_ui_loader_and_manifest_owns_the_collapsible_sidebar():
    shell = text("js/program-shell-unify.js")
    runtime = text("js/pdf-editor/ui-runtime.js")

    assert "/js/pdf-editor/ui-runtime.js?v=${PDF_UI_RUNTIME_VERSION}" in shell
    assert "pdf-editor-pinned-upload-collapsible-sidebar-runtime-v3" in shell
    assert "pdf-editor-pinned-upload-collapsible-sidebar-runtime-v3" in runtime
    assert "/js/pdf-editor/simple-sidebar-ui.js?v=20260831-2" in runtime
    assert "/js/pdf-editor/workflow-ui.js" not in runtime
    assert "/js/pdf-editor/workspace-layout.js" not in runtime
    assert runtime.count("{id:") == 1


def test_ui_manifest_loaders_do_not_take_over_editor_core_state_or_actions():
    for path in (
        "js/design-editor/shell-runtime.js",
        "js/pdf-editor/ui-runtime.js",
    ):
        source = text(path)
        for forbidden in (
            "parsedPages =",
            "uploadedFiles =",
            "downloadBtn.addEventListener",
            "previewBtn.addEventListener",
            "eval(",
            "setInterval(",
        ):
            assert forbidden not in source