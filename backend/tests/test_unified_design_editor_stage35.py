from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SHELL = ROOT / "design-editor" / "index.html"
GENERAL = ROOT / "design-editor" / "general.html"
BRIDGE = ROOT / "js" / "design-editor" / "embedded-runtime.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_unified_design_editor_defaults_to_general_cover_engine_without_outer_sidebar_or_legacy_fallback():
    source = SHELL.read_text(encoding="utf-8")
    for marker in (
        "디자인 편집기",
        'data-mode="cover"',
        "표지디자인",
        "포스터",
        "전단지",
        "초대장/안내장",
        "리플렛(4P~12P)",
        'src="/design-editor/general?embed=1&mode=cover&preset=cover-a4"',
        "single-sidebar-general-engine-shell-no-legacy-fallback",
    ):
        assert marker in source
    assert "legacyCoverFallback:" not in source
    assert "studio-side" not in source
    assert "2단 리플렛" not in source
    assert "3단 리플렛" not in source
    assert "사용자 지정" not in source


def test_unified_shell_routes_supported_default_modes_from_one_frame():
    source = SHELL.read_text(encoding="utf-8")
    for marker in (
        "cover-a4",
        "poster-a4",
        "flyer-a4",
        "leaflet-2",
        "leaflet-3-roll",
        "custom",
        "orientation",
        "w:210,h:297",
        "return `/design-editor/general?${query.toString()}`",
        "program-studio-design-mode",
    ):
        assert marker in source
    assert "general.html?embed=1&preset=" not in source


def test_general_editor_is_preserved_as_the_shared_engine():
    source = GENERAL.read_text(encoding="utf-8")
    for marker in (
        'id="editorShell"',
        'id="artboard"',
        'id="inspector"',
        "../js/design-editor/presets.js",
        "../js/design-editor/app.js",
        "작업영역을 직접 클릭",
    ):
        assert marker in source


def test_embedded_bridge_injects_mode_controls_into_existing_sidebar_and_autostarts_non_cover_modes():
    source = BRIDGE.read_text(encoding="utf-8")
    for marker in (
        "params.get('embed')==='1'",
        "history.replaceState",
        "'/design-editor/index.html'",
        ".top-nav{display:none!important}",
        "document.querySelector('.settings')",
        "document.querySelector('.sidebar')",
        "design-mode-grid",
        "data-design-mode",
        "program-studio-design-mode",
        "app.startProject('custom'",
        "app.startProject(preset)",
        "orientation==='landscape'",
        "leaflet-3-roll",
        "stage:'single-general-editor-dynamic-document-options'",
    ):
        assert marker in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_general_editor_loads_cover_bridge_then_existing_phase_modules():
    source = REGISTER.read_text(encoding="utf-8")
    assert "if(isPath('/design-editor/general','/design-editor/general.html'))" in source
    cover_model = source.index("designEditorCoverModelScriptV1")
    cover_bridge = source.index("designEditorCoverModeBridgeScriptV1")
    embedded = source.index("designEditorEmbeddedRuntimeScriptV1")
    phase2 = source.index("designEditorPhase2ScriptV1")
    output = source.index("designEditorOutputScriptV1")
    assert cover_model < cover_bridge < embedded < phase2 < output
    assert "/js/design-editor/embedded-runtime.js?v=20260821-1" in source
