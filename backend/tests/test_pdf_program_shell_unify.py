from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SHELL = ROOT / "js" / "program-shell-unify.js"
RUNTIME = ROOT / "js" / "sw-register.js"
EDITOR_SMOKE = ROOT / "tests" / "browser" / "pdf-editor-shell-smoke.html"
UTILITY_SMOKE = ROOT / "tests" / "browser" / "pdf-utility-shell-smoke.html"
RUNNER = ROOT / "scripts" / "run_pdf_program_shell_smoke.sh"


def test_pdf_tools_remove_fixed_header_without_losing_actions():
    source = SHELL.read_text(encoding="utf-8")
    for marker in (
        "body[data-program-shell=\"compact\"]>.top-nav{display:none!important}",
        "body[data-program-shell=\"compact\"]{padding-top:0!important}",
        "const save=document.getElementById('navSessionBtn')",
        "const load=document.getElementById('navSessionLoadBtn')",
        "const logout=document.getElementById('navLogout')",
        "const user=document.getElementById('userName')",
        "oldNav.remove()",
        "stage:'pdf-tools-headerless-unified-shell'",
    ):
        assert marker in source


def test_runtime_loads_shared_shell_for_both_pdf_programs():
    runtime = RUNTIME.read_text(encoding="utf-8")
    assert runtime.count("programShellUnifyScriptV1") == 2
    assert runtime.count("/js/program-shell-unify.js?v=20260824-1") == 2


def test_browser_smokes_cover_editor_and_utility_shells():
    editor = EDITOR_SMOKE.read_text(encoding="utf-8")
    utility = UTILITY_SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    assert "PDF editor fixed header removed and actions preserved in workspace" in editor
    assert "PDF utility fixed header removed and account actions preserved in content" in utility
    assert 'pdf-editor-shell-smoke.html' in runner
    assert 'pdf-utility-shell-smoke.html' in runner
