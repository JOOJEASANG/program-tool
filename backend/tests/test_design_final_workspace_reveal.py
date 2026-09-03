from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_direct_design_entry_waits_for_functional_runtime_not_visual_stability_flags():
    source = read("js/app-boot-guard.js")
    assert "function isDirectDesignEntry()" in source
    assert "function designBaseFunctionalReady()" in source
    assert "root.dataset.designCoreRuntime==='1'" in source
    assert "root.dataset.designShellRuntime==='1'" in source
    assert "root.dataset.designFinalWorkspaceReady==='1'" in source
    assert "window.DesignEditorApp?.project" in source
    assert "root.dataset.designSidebarStable==='1'" not in source
    assert "root.dataset.designFocusedWorkspace==='1'" not in source
    assert "root.dataset.designEmbeddedCanvasStable==='1'" not in source
    assert "root.dataset.designFunctionalReady=ready?'1':'0'" in source
    assert "root.dataset.designRevealStage=ready?'functional-runtime':'bounded-fallback'" in source


def test_direct_design_entry_uses_bounded_functional_wait_before_reveal():
    source = read("js/app-boot-guard.js")
    assert "const timeout=isDirectDesignEntry()?6800:4200;" in source
    assert "Design functional runtime did not fully settle before the bounded reveal." in source
    approval = source[source.index("function waitForApproval()") :]
    assert approval.index("clearTimeout(failClosedTimer);") < approval.index("await waitForProtectedFunctionalReady();")
    assert approval.index("await waitForProtectedFunctionalReady();") < approval.index("reveal(functional?'functional-runtime':'functional-timeout');")


def test_shell_runtime_preserves_owner_order_without_rebuilding_essential_workspace():
    source = read("js/design-editor/shell-runtime.js")
    assert "async function finalizeWorkspace()" in source
    assert "window.DesignEditorDraftScope?.restoreCurrentScope?.();" in source
    assert "window.DesignEditorSidebarMenuOrder?.sync?.();" in source
    assert "window.DesignEditorProductSpecificWorkspace?.sync?.();" in source
    assert "window.DesignEditorFocusedWorkspace?.sync?.();" in source
    assert "window.DesignEditorEmbeddedStabilityBootstrap?.sync?.();" in source
    assert "await nextPaint();" in source
    assert "root.dataset.designFinalWorkspaceReady='1';" in source
    assert "SUPPORT_SCRIPT_TIMEOUT_MS=1200" in source
    assert "window.DesignEditorEssentialWorkspace?.sync?.();" not in source
    assert "document.querySelector('.design-flat-panel')" in source
    assert "loadSidebarMenuOrder()" in source
    assert "stage:'design-shell-runtime-manifest-v1'" in source
    assert "finalStage:'design-shell-runtime-final-workspace-v4-functional'" in source


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
