from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DRAFT_SCOPE = ROOT / "js" / "design-editor" / "phase5-draft-scope.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_design_editor_draft_scope_loads_before_embedded_mode_startup():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorDraftScopeScriptV1" in source
    assert "/js/design-editor/phase5-draft-scope.js?v=20260822-2" in source
    draft_scope = source.index("designEditorDraftScopeScriptV1")
    embedded = source.index("designEditorEmbeddedRuntimeScriptV1")
    phase2 = source.index("designEditorPhase2ScriptV1")
    assert draft_scope < embedded < phase2


def test_design_editor_drafts_are_scoped_by_preset_and_physical_size():
    source = DRAFT_SCOPE.read_text(encoding="utf-8")
    for marker in (
        "programTool.designEditor.draft.v1",
        "programTool.designEditor.draft.v2.",
        "programTool.designEditor.draft.index.v2",
        "scopeForProject",
        "project.presetId",
        "project.width",
        "project.height",
        "legacy-migration",
        "app.resumeDraft()",
        "이 작업 종류의 자동 저장본을 복구했습니다.",
        "stage:'preset-and-size-scoped-draft-recovery'",
    ):
        assert marker in source


def test_design_editor_draft_scope_saves_before_mode_navigation_and_without_polling():
    source = DRAFT_SCOPE.read_text(encoding="utf-8")
    for marker in (
        "pagehide",
        "beforeunload",
        "visibilitychange",
        "saveCurrent('pagehide')",
        "saveCurrent('beforeunload')",
        "saveCurrent('hidden')",
    ):
        assert marker in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
