from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / "js" / "design-editor" / "workflow-v2.js"
SIMPLE = ROOT / "js" / "design-editor" / "phase16-simple-interface.js"
DIAGNOSTICS = ROOT / "js" / "design-editor" / "runtime-diagnostics.js"
GLOBAL_UI = ROOT / "js" / "program-studio-ui-v2.js"


def test_design_workflow_v2_is_loaded_only_for_design_editor_surface():
    text = GLOBAL_UI.read_text(encoding="utf-8")
    assert "surface==='design-editor'" in text
    assert "/js/design-editor/workflow-v2.js?v=20260828-1" in text
    assert "designEditorWorkflowV2Script" in text


def test_simple_interface_uses_separate_preferences_for_tools_and_inspector():
    text = SIMPLE.read_text(encoding="utf-8")
    assert "programTool.designEditor.toolsAdvancedOpen.v2" in text
    assert "programTool.designEditor.inspectorAdvancedOpen.v2" in text
    assert "preference(INSPECTOR_PREF_KEY)" in text
    assert "preference(TOOLS_PREF_KEY)" in text
    assert "remember(INSPECTOR_PREF_KEY" in text
    assert "remember(TOOLS_PREF_KEY" in text


def test_legacy_advanced_preference_is_migration_fallback_only():
    text = SIMPLE.read_text(encoding="utf-8")
    assert "LEGACY_PREF_KEY='programTool.designEditor.advancedOpen.v1'" in text
    assert "localStorage.getItem(LEGACY_PREF_KEY)==='1'" in text
    assert "localStorage.setItem(LEGACY_PREF_KEY" not in text


def test_design_diagnostics_ignore_expected_cancellations():
    text = DIAGNOSTICS.read_text(encoding="utf-8")
    assert "function isExpectedCancellation(reason)" in text
    assert "name==='AbortError'" in text
    assert "cancel" in text
    assert "취소" in text
    assert "if(isExpectedCancellation(reason))return;" in text


def test_design_workflow_has_four_guided_steps_and_existing_output_dock():
    text = WORKFLOW.read_text(encoding="utf-8")
    for label in ("STEP 1", "STEP 2", "STEP 3", "STEP 4", "구성", "편집", "정리", "출력"):
        assert label in text
    assert "designOutputTools" in text
    assert "design-output-dock-v2" in text
    assert "designFinalCheckBtn" in text
    assert "designDiagnosticsButton" in text


def test_design_workflow_reuses_existing_quality_safety_and_diagnostics_state():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "DesignEditorRuntimeDiagnostics?.audit" in text
    assert "DesignEditorPrintSafety?.lastSummary" in text
    assert "DesignEditorPrintQuality?.lastSummary" in text
    assert "designFinalCheckBadge" in text


def test_design_workflow_does_not_replace_canvas_render_or_export_functions():
    text = WORKFLOW.read_text(encoding="utf-8")
    forbidden = (
        "renderArtboard =",
        "renderAll =",
        "exportPng =",
        "exportPdf =",
        "window.eval(",
        "setInterval(",
    )
    for marker in forbidden:
        assert marker not in text


def test_design_workflow_uses_bounded_install_and_batched_state_sync():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "attempts<24" in text
    assert "requestAnimationFrame(()=>" in text
    assert "new MutationObserver(queueSync)" in text
    assert "sidebarObserver.observe(sidebar,{childList:true})" in text
