from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RECENT = ROOT / "js" / "design-editor" / "phase7-recent-drafts.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_recent_drafts_load_after_embedded_polish_and_before_phase2():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorRecentDraftsScriptV1" in source
    assert "/js/design-editor/phase7-recent-drafts.js?v=20260821-1" in source
    polish = source.index("designEditorEmbeddedPolishScriptV1")
    recent = source.index("designEditorRecentDraftsScriptV1")
    phase2 = source.index("designEditorPhase2ScriptV1")
    assert polish < recent < phase2


def test_recent_drafts_map_saved_sizes_back_to_the_correct_editor_mode():
    source = RECENT.read_text(encoding="utf-8")
    for marker in (
        "DesignEditorDraftScope?.listDrafts?.()",
        "modeForPreset",
        "detailForDraft",
        "orientation:Number(item.width)>Number(item.height)?'landscape':'portrait'",
        "mode:'custom'",
        "recent-switch",
        "program-studio-design-mode",
        "최근 작업",
        "stage:'recent-preset-draft-shortcuts'",
    ):
        assert marker in source


def test_recent_drafts_are_bounded_and_avoid_polling_watchers():
    source = RECENT.read_text(encoding="utf-8")
    assert ".slice(0,5)" in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
