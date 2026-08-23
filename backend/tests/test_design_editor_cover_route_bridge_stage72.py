import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SHELL = ROOT / "design-editor" / "index.html"
REGISTER = ROOT / "js" / "sw-register.js"
BRIDGE = ROOT / "js" / "design-editor" / "cover-mode-bridge.js"
MODEL = ROOT / "js" / "design-editor" / "cover-model.js"
COVER_HARNESS = ROOT / "tests" / "browser" / "design-editor-cover-smoke.html"
COVER_RUNNER = ROOT / "scripts" / "run_design_editor_cover_smoke.sh"
SUITE_RUNNER = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"


def manifest_entries(source: str):
    block = re.search(r"const DESIGN_EDITOR_RUNTIME_SCRIPTS=Object\.freeze\(\[(.*?)\]\);", source, re.S)
    assert block
    return re.findall(r"\['([^']+)','([^']+)'\]", block.group(1))


def test_stage72_shell_routes_cover_to_general_engine_and_keeps_legacy_fallback():
    source = SHELL.read_text(encoding="utf-8")
    general_cover = "/design-editor/general?embed=1&mode=cover&preset=cover-a4"
    assert f'src="{general_cover}"' in source
    assert f"if(mode==='cover')return '{general_cover}'" in source
    assert "cover:{mode:'cover',preset:'cover-a4'}" in source
    assert "legacyCoverFallback:'/perfect-binding-cover/?embed=1&mode=cover'" in source
    assert "/perfect-binding-cover/?embed=1&mode=cover" in source
    assert (ROOT / "perfect-binding-cover" / "index.html").exists()


def test_stage72_cover_model_and_bridge_are_first_class_runtime_modules_before_embedded_switcher():
    source = REGISTER.read_text(encoding="utf-8")
    entries = manifest_entries(source)
    assert len(entries) == 29
    ids = [entry[0] for entry in entries]
    assert ids.index("designEditorDraftScopeScriptV1") < ids.index("designEditorCoverModelScriptV1")
    assert ids.index("designEditorCoverModelScriptV1") < ids.index("designEditorCoverModeBridgeScriptV1")
    assert ids.index("designEditorCoverModeBridgeScriptV1") < ids.index("designEditorEmbeddedRuntimeScriptV1")
    assert ("designEditorCoverModelScriptV1", "/js/design-editor/cover-model.js?v=20260823-1") in entries
    assert ("designEditorCoverModeBridgeScriptV1", "/js/design-editor/cover-mode-bridge.js?v=20260823-1") in entries


def test_stage72_cover_bridge_starts_cover_preset_in_common_editor_and_restores_scoped_draft():
    source = BRIDGE.read_text(encoding="utf-8")
    for marker in (
        "params.get('mode')==='cover'||params.get('preset')==='cover-a4'",
        "model.registerPreset()",
        "app.project?.presetId!=='cover-a4'",
        "app.startProject('cover-a4')",
        "model.applyToProject(app.project)",
        "root.DesignEditorDraftScope",
        "root.DesignEditorEmbeddedRuntime",
        "scope.restoreCurrentScope()",
        "stage:'unified-general-cover-route-bridge'",
    ):
        assert marker in source
    assert "location.href='/perfect-binding-cover" not in source


def test_stage72_cover_browser_smoke_checks_geometry_common_text_and_scoped_autosave():
    source = COVER_HARNESS.read_text(encoding="utf-8")
    for marker in (
        "mode=cover&preset=cover-a4",
        "ids.size===29&&latest.size===29",
        "project.width===428.5&&project.height===297",
        "project.cover?.spine===8.5",
        "surface.folds[0]===210&&surface.folds[1]===218.5",
        "document.querySelectorAll('.fold-guide').length===2",
        "document.querySelectorAll('.panel-guide-label').length===3",
        "input.value='통합 표지 제목'",
        "scope.startsWith('cover-a4.')",
        "PASS: unified cover spread boots in the general editor",
    ):
        assert marker in source


def test_stage72_cover_runner_is_isolated_and_part_of_existing_browser_suite():
    cover = COVER_RUNNER.read_text(encoding="utf-8")
    suite = SUITE_RUNNER.read_text(encoding="utf-8")
    assert 'PROFILE_DIR="$(mktemp -d)"' in cover
    assert '--user-data-dir="$PROFILE_DIR"' in cover
    assert "--virtual-time-budget=18000" in cover
    for marker in (
        'data-cover-width="428.5"',
        'data-cover-height="297"',
        'data-cover-spine="8.5"',
        'data-cover-folds="210,218.5"',
        'data-cover-runtime="29"',
    ):
        assert marker in cover
    assert 'bash "$ROOT_DIR/scripts/run_design_editor_cover_smoke.sh"' in suite
    assert suite.index("run_design_editor_cover_smoke.sh") < suite.index("run_design_editor_pdf_smoke.sh")


def test_stage72_old_cover_page_is_untouched_while_bridge_migration_starts():
    legacy = (ROOT / "perfect-binding-cover" / "index.html").read_text(encoding="utf-8")
    assert "id=\"pageCount\"" in legacy
    assert "id=\"paperCaliper\"" in legacy
    assert "id=\"spineDirection\"" in legacy
    assert "id=\"pdfBtn\"" in legacy
    assert "RGB" in legacy
    assert MODEL.exists() and BRIDGE.exists()
