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
