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


def test_current_draft_reset_is_available_for_all_design_menus_and_blanks_content():
    source = RESET.read_text(encoding="utf-8")
    for marker in (
        "programTool.designEditor.draft.index.v2",
        "programTool.designEditor.draft.v1",
        "programTool.designEditor.draft.v2.",
        "DesignEditorDraftScope",
        "scopeForProject",
        "draftKey",
        "current.filter(item=>item?.scope!==scope)",
        "scopeFor(saved)===scope",
        "blankProject(project)",
        "background:'#ffffff'",
        "elements:[]",
        "extras:[]",
        "초기화 · 새 작업",
        "현재 메뉴와 규격은 유지하고 디자인 내용만 비워 새 작업을 시작합니다.",
        "saveCurrent?.('reset-new-work')",
        "designeditor:project-reset",
        "stage:'all-design-menus-reset-to-blank-current-spec'",
    ):
        assert marker in source


def test_current_draft_reset_replaces_stale_state_before_reload_and_avoids_polling_watchers():
    source = RESET.read_text(encoding="utf-8")
    assert "confirm(" in source
    clear_scope = source.index("clearScopeStorage(project,scope)")
    write_blank = source.index("localStorage.setItem(LEGACY_KEY,JSON.stringify(fresh))")
    resume_blank = source.index("app.resumeDraft()")
    save_blank = source.index("saveCurrent?.('reset-new-work')")
    reload_page = source.index("location.reload()")
    assert clear_scope < write_blank < resume_blank < save_blank < reload_page
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
