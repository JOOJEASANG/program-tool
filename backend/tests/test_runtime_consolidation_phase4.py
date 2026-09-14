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


def test_pdf_loader_is_enhancement_bootstrap_and_core_manifest_owns_eight_modules():
    loader = executable_text("js/pdf-editor/loader.js")
    core = text("js/pdf-editor/core-runtime.js")

    assert "/js/pdf-editor/core-runtime.js?v=20260914-2" in loader
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
    assert route.count("{id:") == 22
    assert "/js/pdf-editor/page-selection-preview-focus.js?v=20260914-2" in route
    assert "app:'layout'" in route
    assert "/js/pdf-editor/layout-smooth-preview.js?v=20260909-1" in route
    assert "/js/pdf-editor/preview-insert-persistence.js?v=20260914-3" in route
    assert "/js/pdf-editor/output-save-recovery.js?v=20260914-2" in route
    assert "/js/pdf-editor/save-operation.js" not in route
    assert "/js/pdf-editor/divider-modal-layout.js?v=20260830-2" in route
    assert "/js/pdf-editor/divider-ui-corrections.js?v=20260914-2" in route
    assert "pdfDividerUiCorrectionsScriptV1" in route
    assert "post-manifest" in route
    assert "ProgramStudioPdfEditorRuntimeContext" in route
    assert "Promise.all(pending)" in route
    assert "programUsageOutputGuardScriptV1" in route
    assert "/js/program-usage-output-guard.js?v=20260914-1" in route
    assert "pdf-editor-route-runtime-manifest-v4-divider-ui-corrections" in route

    for forbidden in (
        "parsedPages =",
        "uploadedFiles =",
        "downloadBtn.addEventListener",
        "previewBtn.addEventListener",
        "setInterval(",
        "eval(",
    ):
        assert forbidden not in route


def test_pdf_output_save_recovery_keeps_core_click_handler_and_uses_bounded_observers():
    source = text("js/pdf-editor/output-save-recovery.js")
    for marker in (
        "function stateReady()",
        "previewObserver.observe(preview,{attributes:true,attributeFilter:['disabled']})",
        "thumbObserver.observe(thumbs,{childList:true})",
        "direct.disabled=false",
        "core-save-button-recovery-v2-result-download",
    ):
        assert marker in source
    assert "stopImmediatePropagation" not in source
    assert "downloadBtn').addEventListener('click'" not in source
    assert "setInterval(" not in source
    assert "subtree:true" not in source


def test_pdf_result_download_survives_immediate_blob_url_revoke():
    source = text("js/pdf-editor/output-save-recovery.js")

    for marker in (
        "const DOWNLOAD_URL_GRACE_MS=30000",
        "function installResultDownloadDelivery()",
        "href.startsWith('blob:')",
        "document.body.appendChild(this)",
        "protectedUrls.add(href)",
        "scheduleRelease(href)",
        "window.URL.revokeObjectURL=guardedRevoke",
        "pdfResultDownloadDispatch='mounted-blob-v2'",
        "pdfResultDownloadDelivery='blob-grace-v2'",
    ):
        assert marker in source

    # The route helper must not replace the core PDF-save click handler. It only
    # makes the browser delivery step robust after the backend returns the Blob.
    assert "apiProcessPdf(" not in source
    assert "preventDefault" not in source
    assert "stopPropagation" not in source


def test_divider_ui_corrections_keep_studio_renderer_and_simplify_conflicting_controls():
    source = text("js/pdf-editor/divider-ui-corrections.js")

    for marker in (
        "dividerLegacyTextPositionHidden",
        "dividerBackgroundStudioCard",
        "pdfDividerRendererOwner='studio-corrected-v1'",
        "window.__pdfDividerStudioRenderPatchedV3=false",
        "makeTitleBoxesVisible",
        "#dbeafe",
        "#2563eb",
        "divider-ui-corrections-v2-wide-sidebar-ux",
    ):
        assert marker in source

    for ux_marker in (
        "clamp(480px,42vw,640px)",
        "dividerQuickNav",
        "data-divider-jump=\"basic\"",
        "data-divider-jump=\"shape\"",
        "data-divider-jump=\"text\"",
        "pdfDividerUx='enhanced-v2'",
        "dividerSidebarWide='true'",
        "실시간 미리보기",
    ):
        assert ux_marker in source

    assert "setInterval(" not in source
