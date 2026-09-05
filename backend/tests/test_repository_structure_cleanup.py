from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_root_index_has_no_retired_editor_routes():
    source = _read("index.html")
    for dead in [
        "/design-editor/",
        "/document-editor/",
        "/image-editor/",
        "design-editor/general",
        "document-editor/general",
        "image-editor/general",
    ]:
        assert dead not in source
    for live in ["/print-checker/", "/pdf-editor/", "/pdf-preflight/"]:
        assert live in source


def test_apps_index_has_no_retired_editor_routes():
    source = _read("apps/index.html")
    for dead in [
        "/design-editor/",
        "/document-editor/",
        "/image-editor/",
        "design-editor/general",
        "document-editor/general",
        "image-editor/general",
    ]:
        assert dead not in source
    assert "/print-checker?product=" in source


def test_firebase_has_no_retired_editor_rewrites():
    source = _read("firebase.json")
    for dead in [
        '"source": "/design-editor/**"',
        '"source": "/document-editor/**"',
        '"source": "/image-editor/**"',
        '"source": "/design-editor"',
        '"source": "/document-editor"',
        '"source": "/image-editor"',
    ]:
        assert dead not in source
    for live in [
        '"source": "/print-checker"',
        '"source": "/pdf-editor"',
        '"source": "/pdf-preflight"',
    ]:
        assert live in source


def test_hosting_allowlist_has_no_retired_editor_directories():
    source = _read("scripts/prepare_hosting_dist.py")
    for dead in [
        '"design-editor"',
        '"document-editor"',
        '"image-editor"',
    ]:
        assert dead not in source
    for live in [
        '"print-checker"',
        '"pdf-editor"',
        '"pdf-preflight"',
    ]:
        assert live in source


def test_runtime_asset_validator_tracks_only_live_editor_families():
    source = _read("scripts/validate_runtime_assets.py")
    for dead in [
        "design-editor",
        "document-editor",
        "image-editor",
        "DESIGN_EDITOR_RUNTIME_SCRIPTS",
        "DESIGN_EDITOR_GENERAL_ROUTE_IDS",
    ]:
        assert dead not in source
    for live in ["pdf-editor", "pdf-preflight"]:
        assert live in source


def test_static_reference_validator_has_no_retired_editor_allowance():
    source = _read("scripts/validate_static_references.py")
    for dead in [
        "design-editor",
        "document-editor",
        "image-editor",
    ]:
        assert dead not in source


def test_program_ui_has_no_retired_editor_overlay_runtime():
    source = _read("js/program-studio-ui-v2.js")
    for dead in [
        "editor-tool-rail-v1.js",
        "design-text-autofit-v1.js",
        "design-typography-pro-v1.js",
        "design-local-fonts-v1.js",
        "design-shape-border-controls-v1.js",
        "design-shape-inspector-ux-v1.js",
        "design-print-production-stage2-v1.js",
    ]:
        assert dead not in source
    for live in ["/print-checker/", "/pdf-editor/", "/pdf-preflight/"]:
        assert live in source


def test_boot_guard_has_no_retired_editor_runtime_loaders_and_keeps_print_checker_public():
    source = _read("js/app-boot-guard.js")
    for dead in [
        "/design-editor/",
        "/document-editor",
        "/image-editor",
        "DesignEditorApp",
        "designTextAutoFitScriptV1",
        "designTypographyProScriptV1",
        "designLocalFontsScriptV1",
        "designShapeBorderControlsScriptV1",
        "designShapeInspectorUxScriptV1",
        "designPrintProductionStage2ScriptV1",
    ]:
        assert dead not in source
    assert "/print-checker" not in source
    assert "'/pdf-editor'" in source
    assert "'/pdf-preflight'" in source
    assert "return 'design-studio'" in source
    assert "if(!protectedProgram){reveal('public');return;}" in source
    assert "/js/pdf-editor/print-workflow-focus.js" in source
    assert "/js/pdf-preflight-panel-balance.js" in source


def test_shared_runtime_has_no_retired_editor_routes_or_manifest():
    source = _read("js/sw-register.js")
    for dead in [
        "/design-editor",
        "/document-editor",
        "/image-editor",
        "DESIGN_EDITOR_RUNTIME_SCRIPTS",
        "DESIGN_EDITOR_GENERAL_ROUTE_IDS",
    ]:
        assert dead not in source


def test_repository_has_no_retired_editor_directories():
    for dirname in ["design-editor", "document-editor", "image-editor"]:
        assert not (ROOT / dirname).exists()


def test_repository_has_no_retired_editor_runtime_files():
    retired = [
        "js/editor-tool-rail-v1.js",
        "js/design-text-autofit-v1.js",
        "js/design-typography-pro-v1.js",
        "js/design-local-fonts-v1.js",
        "js/design-shape-border-controls-v1.js",
        "js/design-shape-inspector-ux-v1.js",
        "js/design-print-production-stage2-v1.js",
    ]
    for relative in retired:
        assert not (ROOT / relative).exists()
