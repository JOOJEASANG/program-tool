from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SAFETY = ROOT / "js" / "design-editor" / "phase9-mode-switch-safety.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_mode_switch_safety_loads_after_reset_and_before_phase2():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorModeSwitchSafetyScriptV1" in source
    assert "/js/design-editor/phase9-mode-switch-safety.js?v=20260821-1" in source
    reset = source.index("designEditorCurrentDraftResetScriptV1")
    safety = source.index("designEditorModeSwitchSafetyScriptV1")
    phase2 = source.index("designEditorPhase2ScriptV1")
    assert reset < safety < phase2


def test_mode_switch_safety_saves_before_pointer_keyboard_and_page_navigation():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "DesignEditorDraftScope",
        "saveCurrent",
        "mode-switch-intent",
        "mode-switch-keyboard",
        "mode-switch-pagehide",
        "[data-design-mode],.design-mode-apply,.design-recent-item",
        "document.addEventListener('pointerdown',handleNavigationIntent,true)",
        "document.addEventListener('click',handleNavigationIntent,true)",
        "document.addEventListener('keydown',handleKeyboard,true)",
        "stage:'synchronous-save-before-design-mode-navigation'",
    ):
        assert marker in source


def test_mode_switch_safety_avoids_polling_and_reentrant_watchers():
    source = SAFETY.read_text(encoding="utf-8")
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
