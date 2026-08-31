from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_design_editor_uses_dedicated_flat_workspace_instead_of_generic_tool_rail():
    ui = text("js/program-studio-ui-v2.js")
    segment = ui[ui.index("if(surface==='design-editor'){"):ui.index("if(surface==='document-editor'){")]
    assert "loadDesignEssentialWorkspace();" in segment
    assert "loadEditorToolRail();" not in segment
    assert "designEditorEssentialWorkspaceScriptV1" in ui
    assert "/js/design-editor/essential-workspace.js?v=20260831-1" in ui


def test_essential_workspace_is_one_expanded_sidebar_without_step_navigation():
    source = text("js/design-editor/essential-workspace.js")
    assert "design-flat-panel" in source
    assert "flat-expanded-product-aware-workspace-v2" in source
    assert "const STEPS" not in source
    assert "design-essential-rail" not in source
    assert "dataset.editorToolStep='all'" in source
    assert "showAll:()=>true" in source
    assert "designProfessionalWorkflow" in source
    assert "removeWorkflowBar" in source


def test_product_visibility_keeps_cover_tools_cover_only_and_fold_tools_leaflet_only():
    source = text("js/design-editor/essential-workspace.js")
    for card_id in ("designCoverSettingsTools", "designCoverSpineTools", "designCoverPreviewZoneTools"):
        assert card_id in source
    assert "return type==='cover'" in source
    assert "type==='leaflet2'||type==='leaflet3'" in source
    assert "data-design-flat-hidden" in source
    assert "COVER_ONLY_IDS" in source


def test_invitation_is_flat_and_has_no_fold_guide_or_fold_configuration():
    source = text("js/design-editor/essential-workspace.js")
    assert "clearInvitationGeometry" in source
    assert "surface.folds=[]" in source
    assert "delete surface.foldsY" in source
    assert "delete surface.foldAxis" in source
    assert "surface.panels=[]" in source
    for control in ("designProductAxis", "designProductFoldPosition", "designProductFlip", "designProductCenterFold"):
        assert control in source
    assert "초대장·안내장은 접지선 없이 한 장 규격으로 작업합니다." in source
    assert "design-essential-invitation-fold.x" not in source
    assert "art.dataset.invitationFoldGuide" not in source


def test_cover_boundaries_are_structural_and_do_not_depend_on_optional_zone_visibility():
    source = text("js/design-editor/essential-workspace.js")
    assert "designFlatCoverBoundaries" in source
    assert "design-flat-cover-boundary" in source
    assert "const points=[trimW,trimW+spine]" in source
    assert "renderCoverBoundaries" in source


def test_only_internal_status_cards_are_suppressed_from_flat_user_menu():
    source = text("js/design-editor/essential-workspace.js")
    for marker in ("designPrintQualityTools", "designPrintSafetyTools", "designRuntimeDiagnostics"):
        assert marker in source
    assert "designQuickDesignTools" not in source
    assert "디자인 레시피" not in source


def test_selection_contextbar_remains_separate_from_flat_sidebar_policy():
    runtime = text("js/design-editor/shell-runtime.js")
    assert "designSelectionContextbarScriptV1" in runtime
    assert "/js/design-editor/selection-contextbar.js" in runtime


def test_design_browser_suite_runs_flat_workspace_smoke():
    runner = text("scripts/run_design_editor_browser_smoke.sh")
    smoke = text("tests/browser/design-editor-essential-workspace-smoke.html")
    assert "run_design_editor_essential_workspace_smoke.sh" in runner
    assert "dataset.essentialFlat='true'" in smoke
    assert "dataset.essentialAllVisible='true'" in smoke
    assert "dataset.essentialInvitationNoFold='true'" in smoke
    assert "dataset.essentialInvitationCoverHidden='true'" in smoke
    assert "dataset.essentialCoverBoundaries='2'" in smoke
