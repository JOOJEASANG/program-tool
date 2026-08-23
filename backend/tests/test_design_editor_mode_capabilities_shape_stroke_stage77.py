from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
POLISH = ROOT / "js" / "design-editor" / "phase6-embedded-polish.js"
ALIAS = ROOT / "tools" / "perfect-binding-cover.html"
LEGACY = ROOT / "perfect-binding-cover" / "index.html"
HARNESS = ROOT / "tests" / "browser" / "design-editor-mode-shape-smoke.html"
RUNNER = ROOT / "scripts" / "run_design_editor_mode_shape_smoke.sh"
SUITE = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"


def test_stage77_mode_capability_map_keeps_cover_options_cover_only_and_leaflet_fold_only():
    source = POLISH.read_text(encoding="utf-8")
    for marker in (
        "const COVER_ONLY_IDS=Object.freeze(['designCoverSettingsTools','designCoverSpineTools','designCoverPreviewZoneTools'])",
        "cover:Object.freeze(['common','cover'])",
        "poster:Object.freeze(['common'])",
        "flyer:Object.freeze(['common'])",
        "leaflet2:Object.freeze(['common','fold'])",
        "leaflet3:Object.freeze(['common','fold'])",
        "custom:Object.freeze(['common'])",
        "function syncCapabilityVisibility()",
        "node.dataset.designCapability='cover'",
        "node.hidden=!visible",
        "document.documentElement.dataset.activeDesignMode=mode",
    ):
        assert marker in source


def test_stage77_rectangle_and_ellipse_can_disable_border_without_changing_line_semantics():
    source = POLISH.read_text(encoding="utf-8")
    for marker in (
        "const SHAPE_STROKE_MODE_ID='designShapeStrokeMode'",
        "<label for=\"${SHAPE_STROKE_MODE_ID}\">테두리</label>",
        '<option value="on">있음</option><option value="none">없음</option>',
        "current.strokeEnabled=event.target.value!=='none'",
        "const enabled=item.strokeEnabled!==false",
        "if(item.shape==='line')",
        "strokeControls.slice(1)",
        "if(!enabled)inner.style.border='none'",
    ):
        assert marker in source


def test_stage77_borderless_shape_output_is_non_mutating_and_transparent_at_300dpi():
    source = POLISH.read_text(encoding="utf-8")
    for marker in (
        "function installShapeOutputGuard()",
        "const original=output.renderSurface.bind(output)",
        "extras:surface.extras.map",
        "item.strokeEnabled===false?{...item,stroke:'rgba(0,0,0,0)'}:item",
        "wrapped.__shapeStrokeNoneGuard=true",
        "output.renderSurface=wrapped",
    ):
        assert marker in source
    assert "item.stroke='rgba(0,0,0,0)'" not in source


def test_stage77_old_tool_alias_routes_to_unified_cover_while_legacy_fallback_remains_for_template_parity():
    alias = ALIAS.read_text(encoding="utf-8")
    assert "/design-editor/?mode=cover" in alias
    assert "target.searchParams.set('mode','cover')" in alias
    assert "../perfect-binding-cover/" not in alias
    assert LEGACY.exists()
    legacy = LEGACY.read_text(encoding="utf-8")
    assert "책표지" in legacy or "표지" in legacy


def test_stage77_real_browser_checks_irrelevant_options_and_borderless_shape_rendering():
    source = HARNESS.read_text(encoding="utf-8")
    for marker in (
        "supportsCapability('cover')===false",
        "supportsCapability('fold')===false",
        "supportsCapability('common')===true",
        "fakeCover.hidden===true&&fakeFold.hidden===true&&fakeCommon.hidden===false",
        "strokeMode.value='none'",
        "rect.strokeEnabled===false",
        "borderTopStyle==='none'",
        "DesignEditorOutput.renderSurface(project,surface)",
        "line must not expose a border on/off control",
        "visibleStrokeFields.length===1",
        "pass('mode-aware sidebar hides irrelevant options and borderless shapes match 300DPI output')",
    ):
        assert marker in source


def test_stage77_runner_is_isolated_and_chained_before_pdf_smokes():
    runner = RUNNER.read_text(encoding="utf-8")
    suite = SUITE.read_text(encoding="utf-8")
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert '--user-data-dir="$PROFILE_DIR"' in runner
    assert "--virtual-time-budget=30000" in runner
    for marker in (
        'data-mode-shape-mode="flyer"',
        'data-mode-shape-cover-hidden="true"',
        'data-mode-shape-fold-hidden="true"',
        'data-mode-shape-stroke-none="true"',
        'data-mode-shape-rendered-no-border="true"',
        'data-mode-shape-line-stroke-fields="1"',
    ):
        assert marker in runner
    assert 'bash "$ROOT_DIR/scripts/run_design_editor_mode_shape_smoke.sh"' in suite
    assert suite.index("run_design_editor_cover_project_smoke.sh") < suite.index("run_design_editor_mode_shape_smoke.sh") < suite.index("run_design_editor_pdf_smoke.sh")
