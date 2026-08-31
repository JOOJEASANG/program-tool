from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_design_editor_uses_dedicated_essential_workspace_instead_of_generic_all_tools_rail():
    ui = text("js/program-studio-ui-v2.js")
    segment = ui[ui.index("if(surface==='design-editor'){"):ui.index("if(surface==='document-editor'){")]
    assert "loadDesignEssentialWorkspace();" in segment
    assert "loadEditorToolRail();" not in segment
    assert "designEditorEssentialWorkspaceScriptV1" in ui
    assert "/js/design-editor/essential-workspace.js?v=20260831-1" in ui


def test_essential_workspace_has_home_then_four_isolated_groups_and_no_all_tools_menu():
    source = text("js/design-editor/essential-workspace.js")
    assert "node.href='/'" in source
    for step in ("compose", "edit", "arrange", "output"):
        assert f"id:'{step}'" in source
    assert "STEPS.some(item=>item.id===step)?step:'compose'" in source
    assert "step==='all'?'output':step" in source
    assert "design-essential-step-hidden" in source
    assert "visibleMatches===0" not in source
    assert "전체 도구" not in source


def test_product_visibility_is_owned_separately_from_step_visibility():
    source = text("js/design-editor/essential-workspace.js")
    for card_id in ("designCoverSettingsTools", "designCoverSpineTools", "designCoverPreviewZoneTools"):
        assert card_id in source
    assert "type==='cover'" in source
    assert "type==='invitation'||type==='leaflet2'||type==='leaflet3'" in source
    assert "data-design-essential-product-hidden" in source
    assert "node.classList.toggle('design-essential-step-hidden'" in source
    assert "node.hidden=!" not in source


def test_invitation_fold_guide_supports_both_vertical_and_horizontal_axes():
    source = text("js/design-editor/essential-workspace.js")
    assert "currentType()!=='invitation'" in source
    assert "surface.foldAxis==='y'||yFolds.length" in source
    assert "surface.foldsY" in source
    assert "surface.folds" in source
    assert "art.dataset.invitationFoldGuide=axis" in source
    assert "design-essential-invitation-fold.x" in source
    assert "design-essential-invitation-fold.y" in source


def test_redundant_cards_are_not_primary_menu_items():
    source = text("js/design-editor/essential-workspace.js")
    for marker in ("designQuickDesignTools", "designPrintQualityTools", "designPrintSafetyTools"):
        assert marker in source
    assert "design-essential-internal" in source
    assert "designFinalPrintCheckTools" in source
    assert "designOutputTools" in source


def test_design_browser_suite_runs_essential_workspace_smoke():
    runner = text("scripts/run_design_editor_browser_smoke.sh")
    smoke = text("tests/browser/design-editor-essential-workspace-smoke.html")
    assert "run_design_editor_essential_workspace_smoke.sh" in runner
    assert "dataset.essentialHome='true'" in smoke
    assert "dataset.essentialNoAll='true'" in smoke
    assert "dataset.essentialStepIsolation='true'" in smoke
    assert "dataset.essentialInvitationCoverHidden='true'" in smoke
    assert "dataset.essentialInvitationFold='x'" in smoke
