from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RESET = ROOT / "js" / "design-editor" / "phase8-current-draft-reset.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_current_draft_reset_loads_after_recent_drafts_and_before_phase2():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorCurrentDraftResetScriptV1" in source
    assert "/js/design-editor/phase8-current-draft-reset.js?v=20260821-1" in source
    recent = source.index("designEditorRecentDraftsScriptV1")
    reset = source.index("designEditorCurrentDraftResetScriptV1")
    phase2 = source.index("designEditorPhase2ScriptV1")
    assert recent < reset < phase2


def test_current_draft_reset_clears_only_the_current_scope_with_confirmation():
    source = RESET.read_text(encoding="utf-8")
    for marker in (
        "programTool.designEditor.draft.index.v2",
        "programTool.designEditor.draft.v1",
        "DesignEditorDraftScope",
        "scopeForProject",
        "draftKey",
        "current.filter(item=>item?.scope!==scope)",
        "legacyScope===scope",
        "현재 작업 새로 시작",
        "다른 포스터·전단·리플렛 작업은 그대로 유지됩니다.",
        "location.reload()",
        "stage:'reset-only-current-preset-draft'",
    ):
        assert marker in source


def test_current_draft_reset_avoids_polling_and_reentrant_watchers():
    source = RESET.read_text(encoding="utf-8")
    assert "confirm(" in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
