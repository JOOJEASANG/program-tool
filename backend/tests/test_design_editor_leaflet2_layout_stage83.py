from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "design-editor" / "phase25-leaflet2-layout.js"
RESET = ROOT / "js" / "design-editor" / "phase8-current-draft-reset.js"
SMOKE = ROOT / "tests" / "browser" / "design-editor-leaflet2-layout-smoke.html"
RUNNER = ROOT / "scripts" / "run_design_editor_leaflet2_layout_smoke.sh"
SUITE = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"


def test_leaflet2_supports_left_right_and_top_bottom_layouts_without_manifest_growth():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "const LAYOUTS=new Set(['left-right','top-bottom'])",
        "p.leaflet2Layout=layout",
        "surface.foldAxis='y'",
        "surface.foldsY=[roundMm((Number(p.height)||0)/2)]",
        "surface.foldAxis='x'",
        "surface.folds=[roundMm((Number(p.width)||0)/2)]",
        "좌우 2면 · 세로 접지선",
        "상하 2면 · 가로 접지선",
        "stage:'leaflet2-left-right-and-top-bottom-layout'",
    ):
        assert marker in source

    reset = RESET.read_text(encoding="utf-8")
    assert "designEditorLeaflet2LayoutScriptV1" in reset
    assert "/js/design-editor/phase25-leaflet2-layout.js?v=20260824-1" in reset


def test_leaflet2_top_bottom_has_horizontal_guides_safety_and_portable_metadata():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "function rewriteTopBottomGuides()",
        "leaflet2-horizontal-fold-guide",
        "leaflet2-horizontal-panel-label",
        "function horizontalFoldIssues(p=project())",
        "rect.y<fold+FOLD_BUFFER_MM",
        "horizontal-fold",
        "horizontal-image-fold",
        "project()?.leaflet2Layout==='top-bottom'",
        "const requested=cleanLayout(byId(SELECT_ID)?.value)||preferredLayout",
        "source:'leaflet2-layout-option-apply'",
        "gate.confirmBeforeOutput=wrapped",
        "__leaflet2TopBottomGuard=true",
        "persistProject(options.source||'leaflet2-layout')",
    ):
        assert marker in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source


def test_leaflet2_layout_browser_smoke_is_chained_into_design_suite():
    smoke = SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    suite = SUITE.read_text(encoding="utf-8")
    for marker in (
        "layout.applyGeometry('left-right'",
        "select.value='top-bottom'",
        "surface.foldAxis==='y'",
        "surface.foldsY?.length===1",
        "paper.value='a3'",
        "top-bottom layout preserved after size apply",
        "layout.horizontalFoldIssues()",
        "DesignEditorProjectFile.buildPortablePayload(project)",
        "confirmBeforeOutput?.__leaflet2TopBottomGuard===true",
        "pass('leaflet2 left-right and top-bottom folds, size persistence, guides, safety and project persistence')",
    ):
        assert marker in smoke
    assert 'data-leaflet2-size-preserved="true"' in runner
    assert 'data-leaflet2-layout-stage="leaflet2-left-right-and-top-bottom-layout"' in runner
    assert "bash \"$ROOT_DIR/scripts/run_design_editor_leaflet2_layout_smoke.sh\"" in suite
