from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_direct_design_entry_waits_for_final_workspace_not_base_editor():
    source = read("js/app-boot-guard.js")
    assert "function isDirectDesignEntry()" in source
    assert "function directDesignWorkspaceReady()" in source
    assert "root.dataset.designFinalWorkspaceReady==='1'" in source
    assert "root.dataset.designSidebarStable==='1'" in source
    assert "root.dataset.designEmbeddedProjectReady==='1'" in source
    assert "root.dataset.designEmbeddedCanvasStable==='1'" in source
    assert "root.dataset.designFocusedWorkspace==='1'" in source
    assert "root.dataset.designRevealWait='final-workspace'" in source
    assert "root.dataset.designRevealStage='final-workspace'" in source


def test_direct_design_entry_never_falls_back_to_half_built_workspace():
    source = read("js/app-boot-guard.js")
    assert "Final design workspace did not stabilize before reveal." in source
    assert "Direct design workspace is not stable yet; keeping the loading gate closed." in source
    assert "retryApprovalWait();" in source
    assert source.index("await Promise.all([waitForPreflightShell(),waitForDesignShell()]);") < source.index("clearTimeout(failClosedTimer);")


def test_shell_runtime_restores_draft_and_finishes_final_ui_before_ready_marker():
    source = read("js/design-editor/shell-runtime.js")
    assert "async function finalizeWorkspace()" in source
    assert "window.DesignEditorDraftScope?.restoreCurrentScope?.();" in source
    assert "window.DesignEditorSidebarMenuOrder?.sync?.();" in source
    assert "window.DesignEditorProductSpecificWorkspace?.sync?.();" in source
    assert "window.DesignEditorFocusedWorkspace?.sync?.();" in source
    assert "window.DesignEditorEmbeddedStabilityBootstrap?.sync?.();" in source
    assert "await nextPaint();" in source
    assert "root.dataset.designFinalWorkspaceReady='1';" in source
    assert "stage:'design-shell-runtime-manifest-v1'" in source
    assert "finalStage:'design-shell-runtime-final-workspace-v2'" in source


def test_sidebar_order_does_not_rebuild_identical_dom_on_delayed_syncs():
    source = read("js/design-editor/shared/sidebar-menu-order.js")
    assert "let lastLayoutSignature=''" in source
    assert "function currentLayoutSignature()" in source
    assert "function markStable()" in source
    assert "function markDirty()" in source
    assert "root.dataset.designSidebarStable" not in source  # marker is owned through documentElement
    assert "document.documentElement.dataset.designSidebarStable='1'" in source
    assert "if(currentSignature&&currentSignature===lastLayoutSignature)" in source
    assert "removeLabels();" in source
    assert source.index("if(currentSignature&&currentSignature===lastLayoutSignature)") < source.index("removeLabels();", source.index("function reorder()"))
