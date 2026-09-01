from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_focused_workspace_is_loaded_by_general_editor():
    shell = (ROOT / "design-editor" / "general.html").read_text(encoding="utf-8")
    assert "focused-professional-workspace.js?v=20260901-1" in shell


def test_focused_workspace_removes_redundant_panels_and_keeps_header_editing():
    runtime = (ROOT / "js" / "design-editor" / "focused-professional-workspace.js").read_text(encoding="utf-8")
    for marker in (
        "data-design-focused-workspace",
        "designPhase4SmartLayout",
        "designSimpleResultTools",
        "designRotationTools",
        "nativeAddCard",
        "#propertiesPanel",
        "#designSelectionContextbar",
        "#designMultiSelectionContextbar",
        "letterSpacing",
        "lineHeight",
        "rotation",
    ):
        assert marker in runtime


def test_focused_workspace_primes_phase2_before_hiding_source_controls():
    runtime = (ROOT / "js" / "design-editor" / "focused-professional-workspace.js").read_text(encoding="utf-8")
    assert "function preparePhase2Bootstrap()" in runtime
    assert "sidebar.appendChild(inspector)" in runtime
    assert "function releasePhase2Bootstrap()" in runtime
    assert "window.DesignEditorPhase2" in runtime
    assert "phase2AddImage" in runtime
    assert "phase2AddRect" in runtime
    assert "phase2AddEllipse" in runtime
    assert "phase2AddLine" in runtime


def test_removed_right_sidebar_space_is_reclaimed_by_preview():
    runtime = (ROOT / "js" / "design-editor" / "full-preview-workspace.js").read_text(encoding="utf-8")
    assert "data-design-full-preview" in runtime
    assert "--design-right-fixed:0px!important" in runtime
    assert "grid-template-columns:var(--design-focused-left,var(--design-left-open,268px)) minmax(0,1fr)!important" in runtime
    assert "grid-column:2 / -1!important" in runtime
    assert "#propertiesPanel" in runtime
    assert "display:none!important" in runtime
    assert "two-pane-full-preview" in runtime


def test_shell_loads_full_preview_after_ui_revision_and_refreshes_cache_version():
    runtime = (ROOT / "js" / "design-editor" / "shell-runtime.js").read_text(encoding="utf-8")
    index = (ROOT / "design-editor" / "index.html").read_text(encoding="utf-8")
    assert "loadFullPreviewWorkspace" in runtime
    assert "designFullPreviewWorkspaceScriptV1" in runtime
    assert "/js/design-editor/full-preview-workspace.js?v=20260901-1" in runtime
    assert runtime.index("await loadUiRevision()") < runtime.index("await loadFullPreviewWorkspace()")
    assert "DesignEditorFullPreviewWorkspace?.sync?.()" in runtime
    assert "SHELL_RUNTIME_VERSION='20260901-2'" in index
