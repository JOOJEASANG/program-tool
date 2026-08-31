import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def executable_text(path: str) -> str:
    source = text(path)
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    source = re.sub(r"//[^\n]*", "", source)
    return source


def test_global_bootstrap_only_selects_design_and_pdf_route_runtimes():
    sw = executable_text("js/sw-register.js")
    design = text("js/design-editor/core-runtime.js")
    pdf_route = text("js/pdf-editor/route-runtime.js")

    assert "/js/design-editor/core-runtime.js?v=20260828-1" in sw
    assert "/js/pdf-editor/route-runtime.js?v=20260828-1" in sw
    assert "design-editor-core-runtime-manifest-v1" in design
    assert "pdf-editor-route-runtime-manifest-v1" in pdf_route

    for forbidden in (
        "/js/design-editor/runtime-diagnostics.js",
        "/js/design-editor/phase5-draft-scope.js",
        "/js/design-editor/phase2.js",
        "/js/design-editor/output.js",
        "/js/pdf-editor/loader.js",
        "/js/pdf-editor/save-operation.js",
        "/js/pdf-editor/file-navigation.js",
        "/js/pdf-editor/spread-split.js",
    ):
        assert forbidden not in sw


def test_design_core_owns_32_ordered_modules_and_embedded_route_compatibility():
    source = text("js/design-editor/core-runtime.js")
    assert source.count("{id:'designEditor") == 32
    assert "GENERAL_ROUTE_IDS=new Set" in source
    assert "ProgramStudioDesignEditorRuntimeContext" in source
    assert "history.replaceState(history.state,'',generalUrl)" in source
    assert "await loadEntry(entry)" in source
    assert "window.ProgramStudioDesignEditorRuntimeManifest" in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_pdf_loader_is_enhancement_bootstrap_and_core_manifest_owns_eight_modules():
    loader = executable_text("js/pdf-editor/loader.js")
    core = text("js/pdf-editor/core-runtime.js")

    assert "/js/pdf-editor/core-runtime.js?v=20260828-1" in loader
    assert "pdf-editor-enhancement-bootstrap-v19" in loader
    assert "const MODULES" not in loader
    assert "MODULES.forEach(loadScript)" not in loader
    assert core.count("{id:'pdfEditor") == 8
    assert "pdf-editor-core-runtime-manifest-v1" in core

    for module in (
        "font-render-fix.js",
        "upload-fix.js",
        "live-preview.js",
        "layout-export.js",
        "page-count-hint.js",
        "nup-helper.js",
        "preview-row-default.js",
        "divider-helper.js",
    ):
        assert module in core
        assert module not in loader


def test_pdf_route_manifest_owns_route_helpers_without_editor_state_takeover():
    route = text("js/pdf-editor/route-runtime.js")
    assert route.count("{id:") == 20
    assert "/js/pdf-editor/preview-insert-persistence.js?v=20260831-2" in route
    assert "/js/pdf-editor/divider-modal-layout.js?v=20260830-2" in route
    assert "ProgramStudioPdfEditorRuntimeContext" in route
    assert "Promise.all(pending)" in route
    assert "pdf-editor-route-runtime-manifest-v1" in route

    for forbidden in (
        "parsedPages =",
        "uploadedFiles =",
        "downloadBtn.addEventListener",
        "previewBtn.addEventListener",
        "setInterval(",
        "eval(",
    ):
        assert forbidden not in route


def test_nested_manifests_are_part_of_runtime_asset_validation():
    validator = text("scripts/validate_runtime_assets.py")
    for path in (
        'Path("js/design-editor/core-runtime.js")',
        'Path("js/design-editor/shell-runtime.js")',
        'Path("js/pdf-editor/route-runtime.js")',
        'Path("js/pdf-editor/core-runtime.js")',
        'Path("js/pdf-editor/ui-runtime.js")',
        'Path("js/pdf-editor/loader.js")',
    ):
        assert path in validator
