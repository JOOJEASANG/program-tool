from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SHELL = ROOT / "js" / "program-shell-unify.js"
RUNTIME = ROOT / "js" / "sw-register.js"
ROUTE_RUNTIME = ROOT / "js" / "pdf-editor" / "route-runtime.js"
EDITOR_SMOKE = ROOT / "tests" / "browser" / "pdf-editor-shell-smoke.html"
UTILITY_SMOKE = ROOT / "tests" / "browser" / "pdf-utility-shell-smoke.html"
RUNNER = ROOT / "scripts" / "run_pdf_program_shell_smoke.sh"


def test_pdf_tools_remove_fixed_header_without_losing_actions():
    source = SHELL.read_text(encoding="utf-8")
    for marker in (
        'body[data-program-shell="compact"]>.top-nav{display:none!important}',
        'body[data-program-shell="compact"]{padding-top:0!important}',
        "document.getElementById('navSessionBtn')",
        "document.getElementById('navSessionLoadBtn')",
        "document.getElementById('navLogout')",
        "document.getElementById('userName')",
        "oldNav.remove()",
        "stage:'pdf-tools-headerless-unified-shell'",
        "workflowStage:'pdf-all-controls-visible-v1'",
    ):
        assert marker in source


def test_runtime_loads_shared_shell_for_pdf_editor_from_canonical_route_manifest():
    runtime = RUNTIME.read_text(encoding="utf-8")
    route_runtime = ROUTE_RUNTIME.read_text(encoding="utf-8")
    assert "pdfEditorRouteRuntimeScriptV1" in runtime
    assert "programShellUnifyScriptV1" in route_runtime
    assert "/js/program-shell-unify.js?v=20260831-1" in route_runtime
    assert "/js/pdf-editor/ui-runtime.js?v=${PDF_UI_RUNTIME_VERSION}" in SHELL.read_text(encoding="utf-8")


def test_browser_smokes_cover_editor_and_utility_shells():
    editor = EDITOR_SMOKE.read_text(encoding="utf-8")
    utility = UTILITY_SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    assert "PDF sidebar remains visible after delayed common/runtime initialization" in editor
    assert "PDF utility fixed header removed and account actions preserved in content" in utility
    assert "pdf-editor-shell-smoke.html" in runner
    assert "pdf-utility-shell-smoke.html" in runner
