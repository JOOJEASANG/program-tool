from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADVANCED_RUNTIME = ROOT / "js" / "pdf-editor" / "advanced-runtime.js"
ADVANCED_SHELL = ROOT / "js" / "pdf-editor" / "advanced-shell-layout.js"
CORE_RUNTIME = ROOT / "js" / "pdf-editor" / "core-runtime.js"


def test_advanced_runtime_loads_headerless_shell_after_workspace():
    source = ADVANCED_RUNTIME.read_text(encoding="utf-8")
    assert "pdfAdvancedShellLayoutScriptV1" in source
    assert "advanced-shell-layout.js?v=20260909-1" in source
    assert source.index("loadAdvancedWorkspaceUx()") < source.index("loadAdvancedShellLayout()")
    assert source.index("loadAdvancedShellLayout()") < source.index("loadDirectPageEditQuickbar()")
    assert "'advanced-shell-layout'" in source


def test_default_editor_does_not_load_advanced_shell():
    core = CORE_RUNTIME.read_text(encoding="utf-8")
    assert "pdfAdvancedShellLayoutScriptV1" not in core
    assert "advanced-shell-layout.js" not in core


def test_advanced_shell_removes_header_without_losing_actions():
    source = ADVANCED_SHELL.read_text(encoding="utf-8")
    for marker in (
        '.top-nav{display:none!important}',
        'body{padding-top:0!important',
        'height:100vh!important',
        'pdfAdvancedSidebarNavV1',
        "nav?.querySelector('.nav-back')",
        "byId('navSessionBtn')",
        "byId('navSessionLoadBtn')",
        "byId('navLogout')",
        "title.textContent='PDF 고급 편집'",
        "pdfAdvancedHeaderlessShell='1'",
    ):
        assert marker in source


def test_advanced_shell_adds_bidirectional_move_sliders_using_existing_offsets():
    source = ADVANCED_SHELL.read_text(encoding="utf-8")
    for marker in (
        'pdfAdvancedMoveXRangeV1',
        'pdfAdvancedMoveYRangeV1',
        '페이지 좌우 이동',
        '페이지 상하 이동',
        "target=byId(axis==='x'?'pdfNupAdjustX':'pdfNupAdjustY')",
        "target.dispatchEvent(new Event('input',{bubbles:true}))",
        "history.begin(page,'페이지 위치 이동','range')",
        'pdfAdvancedMoveCenterV1',
        "stage:'headerless-layout-move-sliders-v1'",
    ):
        assert marker in source

    assert 'setInterval(' not in source
