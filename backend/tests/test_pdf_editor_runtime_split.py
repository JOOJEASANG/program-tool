import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "js" / "pdf-editor" / "core-runtime.js"
ADVANCED = ROOT / "js" / "pdf-editor" / "advanced-runtime.js"
ADVANCED_SCOPE = ROOT / "js" / "pdf-editor" / "advanced-profile-scope.js"
ADVANCED_WORKSPACE = ROOT / "js" / "pdf-editor" / "advanced-workspace-ux.js"
ROUTE_RUNTIME = ROOT / "js" / "pdf-editor" / "route-runtime.js"
APP_BOOT = ROOT / "js" / "app-boot-guard.js"
RUNTIME_BOOT = ROOT / "js" / "sw-register.js"
FIREBASE = ROOT / "firebase.json"


def test_default_pdf_editor_keeps_21b36a9_sized_core_manifest():
    core = CORE.read_text(encoding="utf-8")
    module_block = core.split("const MODULES=Object.freeze([", 1)[1].split("]);", 1)[0]

    assert module_block.count("src:'/js/pdf-editor/") == 8
    for advanced_id in (
        "pdfPreviewZoomPersistenceScriptV1",
        "pdfNupInteractionStabilityScriptV1",
        "pdfNupPageAdjustScriptV1",
        "pdfPageTransformEditScriptV1",
        "pdfDragCropAutoFitScriptV1",
        "pdfNupDirectPreviewEditScriptV1",
        "pdfEditorInteractionPolishScriptV1",
        "pdfOrientationScaleRegressionScriptV1",
        "pdfPrecisionEditToolsScriptV1",
        "pdfAdvancedWorkspaceUxScriptV1",
    ):
        assert advanced_id not in core

    # Legacy ?profile=advanced compatibility remains isolated inside the general
    # PDF editor for now. The product route /pdf-editor-advanced no longer uses it.
    assert "lightweight-default-advanced-query-v1" in core
    assert "advanced-runtime.js?v=20260908-1" in core
    assert "advanced-profile-scope.js?v=20260908-2" in core
    assert "new URLSearchParams" in core
    assert "get('profile')" in core
    assert "pdfEditorProfile=advanced?'advanced':'lightweight'" in core


def test_legacy_advanced_profile_skips_normal_nup_booklet_and_divider_helpers():
    core = CORE.read_text(encoding="utf-8")

    assert "const ADVANCED_UNUSED_CORE_IDS=new Set([" in core
    assert "'pdfEditorNupHelperScriptV1'" in core
    assert "'pdfEditorDividerHelperScriptV1'" in core
    assert "if(!advanced)ensureBookletStylesheet();" in core
    assert "if(advanced&&ADVANCED_UNUSED_CORE_IDS.has(entry.id))continue;" in core


def test_legacy_advanced_route_runtime_skips_general_print_layout_helpers():
    route = ROUTE_RUNTIME.read_text(encoding="utf-8")

    assert "const ADVANCED_UNUSED_ROUTE_IDS=new Set([" in route
    for module_id in (
        "pdfPreviewInsertPersistenceScriptV1",
        "pdfDividerLocalImageUploadScriptV1",
        "pdfDividerModalLayoutScriptV1",
        "pdfEditorSpreadSplitScriptV1",
        "pdfBookletSheetPreviewScriptV1",
    ):
        assert f"'{module_id}'" in route
    assert "if(advanced&&ADVANCED_UNUSED_ROUTE_IDS.has(entry.id))continue;" in route
    assert "pdfAdvancedRouteModules='minimal'" in route


def test_legacy_advanced_scope_hides_creation_and_layout_features_but_preserves_existing_pages():
    scope = ADVANCED_SCOPE.read_text(encoding="utf-8")

    for marker in (
        "pdfEditorAdvancedMinimal",
        ".prev-ins-zone,.prev-ins-zone-v",
        ".mode-btn[data-mode=\"break\"]",
        "document.getElementById('dividerModal')",
        "document.getElementById('pdfSpreadSplitPanel')",
        "#sb-nup > .field:nth-of-type(2)",
        "슬라이드\\s*순서",
        "#thumbCtxMenu .ctx-item",
        "빈\\s*페이지\\s*(삽입|추가)",
        "간지\\s*(삽입|추가)",
        "페이지 위치·크기 보정",
        "파일 업로드 · 페이지 정렬/삭제 · 자르기/회전 · 위치/크기 보정 · PDF 저장",
        "minimal:true",
    ):
        assert marker in scope

    assert "if(!page||page.pageType==='blank'||page.pageType==='divider')return;" in scope
    assert "parsedPages.splice" not in scope
    assert "pageType==='blank'" in scope
    assert "pageType==='divider'" in scope


def test_legacy_advanced_runtime_still_owns_compatibility_editing_modules():
    advanced = ADVANCED.read_text(encoding="utf-8")
    expected = (
        "pdfPreviewZoomPersistenceScriptV1",
        "pdfNupInteractionStabilityScriptV1",
        "pdfNupPageAdjustScriptV1",
        "pdfPageTransformEditScriptV1",
        "pdfDragCropAutoFitScriptV1",
        "pdfNupDirectPreviewEditScriptV1",
        "pdfEditorInteractionPolishScriptV1",
        "pdfOrientationScaleRegressionScriptV1",
        "pdfPrecisionEditToolsScriptV1",
        "pdfAdvancedWorkspaceUxScriptV1",
    )
    for marker in expected:
        assert marker in advanced

    assert "pdf-editor-advanced-runtime-v1" in advanced
    assert advanced.index("loadPreviewZoomPersistence()") < advanced.index("loadNupInteractionStability()")
    assert advanced.index("loadNupPageAdjust()") < advanced.index("loadPageTransformEdit()")
    assert advanced.index("loadPageTransformEdit()") < advanced.index("loadDragCropAutoFit()")
    assert advanced.index("loadDragCropAutoFit()") < advanced.index("loadNupDirectPreviewEdit()")
    assert advanced.index("loadEditorInteractionPolish()") < advanced.index("loadOrientationScaleRegression()")
    assert advanced.index("loadOrientationScaleRegression()") < advanced.index("loadPrecisionEditTools()")
    assert advanced.index("loadPrecisionEditTools()") < advanced.index("loadAdvancedWorkspaceUx()")


def test_legacy_advanced_workspace_remains_compatibility_only():
    workspace = ADVANCED_WORKSPACE.read_text(encoding="utf-8")

    for marker in (
        "_previewPerRow=1",
        "select.value='1'",
        "select.disabled=true",
        "max-height:136px",
        "scrollbar-gutter:stable",
        "#statusBar{display:flex!important;height:34px!important",
        "pdfAdvancedQuickBarV1",
        "pdfAdvancedPrevPageV1",
        "pdfAdvancedNextPageV1",
        "pdfAdvancedRotateLeftV1",
        "pdfAdvancedRotateRightV1",
        "pdfAdvancedCropV1",
        "pdfAdvancedUndoV1",
        "pdfAdvancedRedoV1",
        "viewportSnapshot",
        "restoreBurst",
        "stable-single-page-workspace-v1",
    ):
        assert marker in workspace

    assert "hideSection('paper')" in workspace
    assert "hideSection('edit')" in workspace
    assert "nup=1" in workspace
    assert "window.PdfPrecisionEditTools?.history?.undo?.()" in workspace
    assert "window.PdfPrecisionEditTools?.history?.redo?.()" in workspace


def test_firebase_advanced_entry_is_a_standalone_rewrite_not_a_query_redirect():
    config = json.loads(FIREBASE.read_text(encoding="utf-8"))
    redirects = config["hosting"]["redirects"]
    redirect_sources = {item.get("source") for item in redirects}
    rewrites = config["hosting"]["rewrites"]
    rewrite_pairs = {(item.get("source"), item.get("destination")) for item in rewrites}

    assert "/pdf-editor-advanced" not in redirect_sources
    assert ("/pdf-editor-advanced", "/pdf-editor-advanced/index.html") in rewrite_pairs
    assert ("/pdf-editor-advanced", "/pdf-editor/index.html") not in rewrite_pairs


def test_advanced_standalone_route_shares_access_guard_but_not_layout_boot_logic():
    source = APP_BOOT.read_text(encoding="utf-8")

    assert "'/pdf-editor-advanced'" in source  # protected access mapping
    assert "function isStandaloneAdvancedPdfEditor()" in source
    assert "root.dataset.pdfAdvancedStandaloneRoute='1'" in source
    assert "root.dataset.pdfPrintWorkflowSuppressed='standalone-advanced'" in source
    assert "function isPdfPrintEditor(){return ['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html']" in source
    assert "isPdfPrintEditor()&&!legacyAdvancedProfile" in source


def test_runtime_bootstrap_protects_advanced_but_never_loads_general_pdf_runtime_for_it():
    source = RUNTIME_BOOT.read_text(encoding="utf-8")

    protected_block = source.split("function isProtectedRuntimePage(){", 1)[1].split("const reveal=", 1)[0]
    helpers_block = source.split("async function helpers(){", 1)[1].split("async function boot(){", 1)[0]
    assert "'/pdf-editor-advanced'" in protected_block
    assert "'/pdf-editor-advanced'" not in helpers_block
    assert "if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'))tasks.push(loadPdfEditorRuntime());" in helpers_block
