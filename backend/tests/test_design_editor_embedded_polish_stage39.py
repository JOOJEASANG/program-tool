from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
POLISH = ROOT / "js" / "design-editor" / "phase6-embedded-polish.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_embedded_polish_loads_after_mode_bridge_and_before_phase2():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorEmbeddedPolishScriptV1" in source
    assert "/js/design-editor/phase6-embedded-polish.js?v=20260821-1" in source
    embedded = source.index("designEditorEmbeddedRuntimeScriptV1")
    polish = source.index("designEditorEmbeddedPolishScriptV1")
    phase2 = source.index("designEditorPhase2ScriptV1")
    assert embedded < polish < phase2


def test_embedded_polish_removes_obsolete_inner_start_flow_and_marks_saved_modes():
    source = POLISH.read_text(encoding="utf-8")
    for marker in (
        "params.get('embed')==='1'",
        ".start-screen{display:none!important}",
        "#newDesignBtn{display:none!important}",
        "DesignEditorDraftScope?.listDrafts?.()",
        "modeForPreset",
        "has-saved",
        "자동 저장된 작업 있음",
        "다시 돌아와도 이어서 작업할 수 있습니다.",
        "keepModeCardFirst",
        "position:sticky!important",
        "showContextMenu",
        "handleWheel",
        "stage:'top-pinned-mode-selector-wheel-and-context-menu'",
    ):
        assert marker in source


def test_embedded_polish_sidebar_watcher_is_scoped_and_reentrancy_guarded():
    source = POLISH.read_text(encoding="utf-8")
    assert "if(pinning)return false" in source
    assert "sidebarObserver=new MutationObserver" in source
    assert "sidebarObserver.observe(sidebar,{childList:true});" in source
    assert "subtree:true" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
