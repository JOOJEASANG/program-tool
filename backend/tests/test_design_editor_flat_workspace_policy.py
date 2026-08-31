from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_design_sidebar_is_one_flat_expanded_menu_without_step_rail():
    source = read("js/design-editor/essential-workspace.js")
    assert "design-flat-panel" in source
    assert "flat-expanded-product-aware-workspace-v2" in source
    assert "design-essential-rail" not in source
    assert "const STEPS" not in source
    assert "design-essential-step-hidden" in source  # cleanup of retired classes only
    assert "dataset.editorToolStep='all'" in source


def test_preview_workflow_bar_is_removed_but_selection_contextbar_stays_owned():
    workspace = read("js/design-editor/essential-workspace.js")
    shell_runtime = read("js/design-editor/shell-runtime.js")
    assert "designProfessionalWorkflow" in workspace
    assert "removeWorkflowBar" in workspace
    assert "designSelectionContextbarScriptV1" in shell_runtime
    assert "/js/design-editor/selection-contextbar.js" in shell_runtime


def test_cover_has_structural_back_spine_front_boundaries_independent_of_zone_preferences():
    source = read("js/design-editor/essential-workspace.js")
    assert "designFlatCoverBoundaries" in source
    assert "design-flat-cover-boundary" in source
    assert "const points=[trimW,trimW+spine]" in source
    assert "currentType()!=='cover'" in source


def test_invitation_has_no_fold_geometry_or_fold_controls_and_hides_cover_only_cards():
    source = read("js/design-editor/essential-workspace.js")
    assert "clearInvitationGeometry" in source
    assert "surface.folds=[]" in source
    assert "delete surface.foldsY" in source
    assert "delete surface.foldAxis" in source
    assert "surface.panels=[]" in source
    assert "designProductAxis" in source
    assert "designProductFoldPosition" in source
    assert "designProductFlip" in source
    assert "designProductCenterFold" in source
    assert "초대장·안내장은 접지선 없이 한 장 규격으로 작업합니다." in source
    assert "COVER_ONLY_IDS" in source
    assert "return type==='cover'" in source
    assert "type==='leaflet2'||type==='leaflet3'" in source
