from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_direct_design_entry_tracks_final_workspace_after_base_reveal():
    source = read("js/app-boot-guard.js")
    assert "function isDirectDesignEntry()" in source
    assert "function directDesignWorkspaceReady()" in source
    assert "root.dataset.designFinalWorkspaceReady==='1'" in source
    assert "root.dataset.designSidebarStable==='1'" in source
    assert "root.dataset.designEmbeddedProjectReady==='1'" in source
    assert "root.dataset.designEmbeddedCanvasStable==='1'" in source
    assert "root.dataset.designFocusedWorkspace==='1'" in source
    assert "root.dataset.designEnhancementReady=ready?'1':'0'" in source
    assert "root.dataset.designRevealStage=ready?'enhanced':'base-interactive'" in source


def test_direct_design_entry_does_not_relock_base_workspace_for_enhancements():
    source = read("js/app-boot-guard.js")
    assert "keeping the loading gate closed" not in source
    assert "Final design workspace did not stabilize before reveal." not in source
    assert "Design enhancements did not fully stabilize, but the base editor remains interactive." in source
    approval = source[source.index("function waitForApproval()") :]
    assert approval.index("clearTimeout(failClosedTimer);") < approval.index("reveal();")
    assert approval.index("reveal();") < approval.index("observeEnhancementReadiness();")


def test_shell_runtime_restores_draft_and_finishes_final_ui_before_ready_marker():
    source = read("js/design-editor/shell-runtime.js")
    assert "async function finalizeWorkspace()" in source
    assert "window.DesignEditorDraftScope?.restoreCurrentScope?.();" in source
    assert "window.DesignEditorEssentialWorkspace?.sync?.();" in source
    assert "window.DesignEditorSidebarMenuOrder?.sync?.();" in source
    assert "window.DesignEditorProductSpecificWorkspace?.sync?.();" in source
    assert "window.DesignEditorFocusedWorkspace?.sync?.();" in source
    assert "window.DesignEditorEmbeddedStabilityBootstrap?.sync?.();" in source
    assert "await nextPaint();" in source
    assert "root.dataset.designFinalWorkspaceReady='1';" in source
    assert "await loadEssentialWorkspace();" in source
    assert "await loadSidebarMenuOrder();" in source
    assert source.index("await loadEssentialWorkspace();") < source.index("await loadSidebarMenuOrder();")
    assert "stage:'design-shell-runtime-manifest-v1'" in source
    assert "finalStage:'design-shell-runtime-final-workspace-v3'" in source


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
