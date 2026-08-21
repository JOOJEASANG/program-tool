from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PHASE3 = ROOT / "js" / "design-editor" / "phase3-controls.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_phase3_loads_after_existing_general_editor_modules():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorPhase3ControlsScriptV1" in source
    assert "/js/design-editor/phase3-controls.js?v=20260821-1" in source
    assert source.index("designEditorOutputScriptV1") < source.index("designEditorPhase3ControlsScriptV1")


def test_phase3_keeps_simple_professional_alignment_and_keyboard_nudge():
    source = PHASE3.read_text(encoding="utf-8")
    for marker in (
        "빠른 배치",
        "안전여백 기준으로 정렬",
        "data-phase3-align=\"left\"",
        "data-phase3-align=\"center\"",
        "data-phase3-align=\"right\"",
        "data-phase3-align=\"top\"",
        "data-phase3-align=\"middle\"",
        "data-phase3-align=\"bottom\"",
        "event.shiftKey?5:.5",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
    ):
        assert marker in source


def test_phase3_adds_direct_resize_without_changing_output_model_shape():
    source = PHASE3.read_text(encoding="utf-8")
    for marker in (
        "phase3-resize-handle",
        "beginResize",
        "handleResizeMove",
        "item.w=clamp",
        "item.h=clamp",
        "item.size=clamp",
        "item.type==='image'",
        "event.shiftKey",
    ):
        assert marker in source
    assert "rotation" not in source


def test_phase3_undo_redo_reuses_existing_project_autosave_boundary():
    source = PHASE3.read_text(encoding="utf-8")
    for marker in (
        "programTool.designEditor.draft.v1",
        "MAX_HISTORY=32",
        "captureSnapshot",
        "applyHistory",
        "window.DesignEditorApp?.resumeDraft?.()",
        "phase3Undo",
        "phase3Redo",
        "stage:'lightweight-layout-resize-history-controls'",
    ):
        assert marker in source


def test_phase3_avoids_reentrant_runtime_watchers_and_eval():
    source = PHASE3.read_text(encoding="utf-8")
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
