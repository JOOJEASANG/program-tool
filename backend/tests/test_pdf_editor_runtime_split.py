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

    assert "lightweight-default-advanced-query-v1" in core
    assert "advanced-runtime.js?v=20260908-1" in core
    assert "new URLSearchParams" in core
    assert "get('profile')" in core
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


def test_firebase_advanced_entry_redirects_to_canonical_protected_editor_profile():
    config = json.loads(FIREBASE.read_text(encoding="utf-8"))
    redirects = config["hosting"]["redirects"]
    redirect_triples = {
        (item.get("source"), item.get("destination"), item.get("type"))
        for item in redirects
    }
    rewrites = config["hosting"]["rewrites"]
    rewrite_sources = {item.get("source") for item in rewrites}

    assert ("/pdf-editor-advanced", "/pdf-editor?profile=advanced", 302) in redirect_triples
    assert "/pdf-editor-advanced" not in rewrite_sources
    assert "/pdf-editor-advanced/**" not in rewrite_sources


def test_runtime_bootstrap_stays_on_canonical_pdf_editor_route():
    source = RUNTIME_BOOT.read_text(encoding="utf-8")

    assert "if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'))tasks.push(loadPdfEditorRuntime());" in source
    assert "pdf-editor-advanced" not in source
