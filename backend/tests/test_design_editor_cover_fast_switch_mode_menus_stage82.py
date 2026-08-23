from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BRIDGE = ROOT / "js" / "design-editor" / "cover-mode-bridge.js"
POLISH = ROOT / "js" / "design-editor" / "phase6-embedded-polish.js"
HOME_SUITE = ROOT / "js" / "home-professional-suite.js"
LEGACY = ROOT / "perfect-binding-cover" / "index.html"
HARNESS = ROOT / "tests" / "browser" / "design-editor-cover-mode-menu-smoke.html"
RUNNER = ROOT / "scripts" / "run_design_editor_cover_mode_menu_smoke.sh"
SUITE = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"


def test_stage82_cover_selection_uses_in_place_bridge_instead_of_parent_reload():
    source = BRIDGE.read_text(encoding="utf-8")
    for marker in (
        "function activateCoverInPlace(source='mode-button')",
        "document.addEventListener('click',handleModeButtonCapture,true)",
        "event.stopImmediatePropagation()",
        "app.startProject('cover-a4')",
        "model.applyToProject(app.project)",
        "history.replaceState(history.state,'','/design-editor/index.html?embed=1&mode=cover&preset=cover-a4')",
        "runtime.switchGeneralMode({mode:next},'cover-mode-button')",
        "programstudio:design-mode-change",
    ):
        assert marker in source
    assert "4200" not in source
    assert "3600" not in source
    assert "2600" not in source
    assert "2200" not in source


def test_stage82_cover_specific_sidebar_capabilities_are_real_cover_only_panels():
    source = POLISH.read_text(encoding="utf-8")
    for marker in (
        "const COVER_ONLY_IDS=Object.freeze(['designCoverSettingsTools','designCoverSpineTools','designCoverPreviewZoneTools'])",
        "cover:Object.freeze(['common','cover'])",
        "poster:Object.freeze(['common'])",
        "flyer:Object.freeze(['common'])",
        "leaflet2:Object.freeze(['common','fold'])",
        "leaflet3:Object.freeze(['common','fold'])",
        "custom:Object.freeze(['common'])",
        "node.dataset.designCapability='cover'",
        "node.hidden=!visible",
    ):
        assert marker in source


def test_stage82_public_home_uses_direct_unified_editor_while_legacy_cover_url_stays_compatibility_only():
    home = HOME_SUITE.read_text(encoding="utf-8")
    legacy = LEGACY.read_text(encoding="utf-8")
    assert "id:'design-editor'" in home
    assert "url:'design-editor/'" in home
    assert "raw==='perfect-binding-cover/'||raw==='/perfect-binding-cover/'" in home
    assert "return base.url" in home
    assert "/design-editor/?mode=cover" in legacy
    assert "location.replace" in legacy


def test_stage82_real_browser_switches_cover_flyer_cover_and_checks_actual_spine_menu_visibility():
    source = HARNESS.read_text(encoding="utf-8")
    for marker in (
        "designCoverSettingsTools",
        "designCoverSpineTools",
        "designCoverPreviewZoneTools",
        "panel.hidden===false&&panel.getAttribute('aria-hidden')==='false'",
        "flyerButton.click()",
        "project?.designMode==='flyer'",
        "panel.hidden===true&&panel.getAttribute('aria-hidden')==='true'",
        "coverButton.click()",
        "project?.designMode==='cover'",
        "location.pathname.endsWith('/design-editor/index.html')",
        "pass('cover switches in place and real cover-only sidebar menus follow the selected design mode')",
    ):
        assert marker in source


def test_stage82_cover_mode_menu_browser_runner_is_part_of_full_suite():
    runner = RUNNER.read_text(encoding="utf-8")
    suite = SUITE.read_text(encoding="utf-8")
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert '--user-data-dir="$PROFILE_DIR"' in runner
    assert "--virtual-time-budget=30000" in runner
    for marker in (
        'data-cover-mode-menu-cover-visible="true"',
        'data-cover-mode-menu-flyer-hidden="true"',
        'data-cover-mode-menu-return-visible="true"',
        'data-cover-mode-menu-no-reload="true"',
    ):
        assert marker in runner
    assert 'bash "$ROOT_DIR/scripts/run_design_editor_cover_mode_menu_smoke.sh"' in suite
    assert suite.index("run_design_editor_cover_smoke.sh") < suite.index("run_design_editor_cover_mode_menu_smoke.sh") < suite.index("run_design_editor_cover_project_smoke.sh")
