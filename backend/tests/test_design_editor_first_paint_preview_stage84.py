from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_design_general_reveals_after_access_without_waiting_for_full_runtime_chain():
    guard = read("js/app-boot-guard.js")
    assert "async function waitForDesignShell()" in guard
    assert "window.DesignEditorEssentialWorkspace?.stage" in guard
    assert "window.DesignEditorApp" in guard
    assert "await Promise.all([waitForPreflightShell(),waitForDesignShell()])" in guard
    assert "if(!access){retryApprovalWait();return;}" in guard
    assert "clearTimeout(failClosedTimer)" in guard
    assert "async function waitForDesignRuntime()" not in guard
    assert "await waitForDesignRuntime();" not in guard
    assert "window.ProgramStudioRuntimeReady" not in guard


def test_outer_design_shell_reveals_approved_base_editor_while_enhancements_continue():
    shell = read("design-editor/index.html")
    assert "async function waitForFrameReady()" in shell
    assert "doc.documentElement.dataset.appReady==='true'" in shell
    assert "Boolean(win.DesignEditorApp)" in shell
    assert "Boolean(win.DesignEditorEssentialWorkspace?.stage)" in shell
    assert "Date.now()-baseReadyAt>=1200" in shell
    assert "shell.dataset.readyStage=enhancedReady?'enhanced':'base'" in shell
    assert "Promise.resolve(win.DesignEditorShellRuntime.loadAll())" in shell
    assert "doc.documentElement.dataset.designCoreRuntime==='1'" not in shell
    assert "firstPaintStage:'approved-base-shell-reveal-v2'" in shell


def test_cover_preview_refits_after_internal_workspace_resizes():
    source = read("js/design-editor/preview-fit-refresh.js")
    runtime = read("js/design-editor/shell-runtime.js")
    assert "ResizeObserver" in source
    assert "resizeObserver.observe(viewport)" in source
    assert "window.dispatchEvent(new Event('resize'))" in source
    assert "data-design-cover-preview-fit" in source
    assert "padding:20px 26px 32px!important" in source
    assert "DesignEditorPreviewFitRefresh" in source
    assert "designPreviewFitRefreshScriptV1" in runtime
    assert runtime.index("designPreviewFitRefreshScriptV1") > runtime.index("designProfessionalUiScriptV1")
