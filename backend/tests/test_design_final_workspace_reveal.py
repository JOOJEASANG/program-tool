from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_direct_design_entry_waits_for_interaction_stable_shell_not_visual_workspace_flags():
    source = read("js/app-boot-guard.js")
    assert "function isDirectDesignEntry()" in source
    assert "function designBaseFunctionalReady()" in source
    assert "const app=window.DesignEditorApp;" in source
    assert "const coreReady=root.dataset.designCoreRuntime==='1';" in source
    assert "if(!appReady||!coreReady)return false;" in source
    assert "if(!app.project||!shell||shell.classList.contains('hidden'))return false;" in source
    assert "const shellReady=root.dataset.designShellRuntime==='1'||root.dataset.designFinalWorkspaceReady==='1';" in source
    assert "if(!shellReady)return false;" in source
    assert "const artboard=document.getElementById('artboard');" in source
    assert "rect&&rect.width>20&&rect.height>20" in source
    assert "root.dataset.designFunctionalBaseline=ready?'1':'0'" in source
    assert "root.dataset.designSidebarStable==='1'" not in source
    assert "root.dataset.designFocusedWorkspace==='1'" not in source
    assert "root.dataset.designEmbeddedCanvasStable==='1'" not in source
    assert "root.dataset.designFunctionalReady=ready?'1':'0'" in source
    assert "root.dataset.designRevealStage=ready?'interaction-stable-shell':'bounded-fallback'" in source


def test_direct_design_entry_uses_bounded_interaction_shell_wait_before_reveal():
    source = read("js/app-boot-guard.js")
    assert "const timeout=isDirectDesignEntry()?6800:4200;" in source
    assert "Design interaction shell did not fully settle before the bounded reveal." in source
    approval = source[source.index("function waitForApproval()") :]
    assert approval.index("clearTimeout(failClosedTimer);") < approval.index("await waitForProtectedFunctionalReady();")
    assert approval.index("await waitForProtectedFunctionalReady();") < approval.index("reveal(functional?'functional-runtime':'functional-timeout');")


def test_modular_design_parent_reveals_on_functional_project_not_visual_workspace_flag():
    source = read("js/studio-app-shell.js")
    reveal = source[source.index("function designFrameCanReveal()") : source.index("function startFrameProbe()")]
    assert "Boolean(win.DesignEditorApp)" in reveal
    assert "projectReady" in reveal
    assert "bootStable" in reveal
    assert "designFocusedWorkspace" not in reveal
    assert "focused-professional-workspace.js" not in source.split("const DESIGN_PRELOADS=[", 1)[1].split("];", 1)[0]
    assert "markFrameReady('functional-project-probe')" in source
    assert "setTimeout(probe,40)" in source


def test_design_startup_observers_do_not_watch_full_body_after_editor_is_ready():
    focused = read("js/design-editor/focused-professional-workspace.js")
    embedded = read("js/design-editor/embedded-stability-bootstrap.js")
    assert "observer.observe(document.body,{childList:true,subtree:true})" not in focused
    assert "observer.observe(sidebar,{childList:true,subtree:true})" in focused
    assert "observer.observe(toolbar,{childList:true,subtree:false})" in focused
    assert "observer.observe(properties,{childList:true,subtree:false})" in focused
    assert "document.documentElement.dataset.designFocusedObserverScope='workspace-only'" in focused
    assert "if(document.body)observer.observe(document.body,{childList:true,subtree:true});" in embedded
    assert "observer.disconnect();" in embedded
    assert "root.dataset.designEmbeddedStabilityObserver='released'" in embedded
    assert embedded.index("observer.disconnect();") < embedded.index("function queueReadyCheck()")


def test_cover_preview_guide_does_not_rebuild_identical_geometry_on_every_click_or_resize():
    source = read("js/design-editor/cover-preview-zones.js")
    assert "let lastRenderSignature=''" in source
    assert "let lastOverlay=null" in source
    assert "function renderSignature(artboard,p)" in source
    assert "overlay===lastOverlay&&signature===lastRenderSignature" in source
    assert source.index("overlay===lastOverlay&&signature===lastRenderSignature") < source.index("overlay.replaceChildren()")
    click_handler = source[source.index("document.addEventListener('click'") : source.index("document.addEventListener('contextmenu'")]
    assert "queueRender()" not in click_handler
    assert "window.addEventListener('resize',queueRender" in source
    assert "programstudio:cover-geometry-change" in source
    assert "stage:'preview-zones-stable-geometry-v2'" in source


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