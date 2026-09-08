import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "js" / "pdf-editor" / "core-runtime.js"
ADVANCED = ROOT / "js" / "pdf-editor" / "advanced-runtime.js"
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
    ):
        assert advanced_id not in core

    assert "lightweight-default-advanced-route-v1" in core
    assert "advanced-runtime.js?v=20260908-1" in core
    assert "pdfEditorProfile=advanced?'advanced':'lightweight'" in core


def test_advanced_runtime_owns_all_post_21b36a9_editing_modules():
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


def test_firebase_exposes_advanced_editor_as_separate_route_to_shared_shell():
    config = json.loads(FIREBASE.read_text(encoding="utf-8"))
    rewrites = config["hosting"]["rewrites"]
    pairs = {(item.get("source"), item.get("destination")) for item in rewrites}

    assert ("/pdf-editor-advanced", "/pdf-editor/index.html") in pairs
    assert ("/pdf-editor-advanced/**", "/pdf-editor/index.html") in pairs


def test_runtime_bootstrap_recognizes_advanced_editor_base_and_nested_routes():
    source = RUNTIME_BOOT.read_text(encoding="utf-8")

    assert "function isPdfEditorPath()" in source
    assert "'/pdf-editor-advanced'" in source
    assert "currentPath.startsWith('/pdf-editor-advanced/')" in source
    assert "if(isPdfEditorPath())tasks.push(loadPdfEditorRuntime());" in source
    assert "return isPdfEditorPath()||isPath(" in source
