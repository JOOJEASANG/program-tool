from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_modular_app_shell_retries_when_initial_access_promise_resolves_empty():
    source = read("js/studio-app-shell.js")
    assert "function retryAccess()" in source
    assert "if(result||document.documentElement.dataset.accessReady==='true'){grantAccess();return;}" in source
    assert "retryAccess();" in source
    assert "if(!accessGranted||!frameReady)return;" in source
    assert "modular-app-shell-product-context-v5-access-race-safe" in source
    assert "modular-app-shell-parallel-engine-preload-v1" in source


def test_design_modular_shell_reveals_only_after_stable_focused_workspace_readiness():
    source = read("js/studio-app-shell.js")
    assert "function designFrameCanReveal()" in source
    assert "Boolean(win.DesignEditorApp)" in source
    assert "doc.documentElement.dataset.designFocusedWorkspace==='1'" in source
    assert "!doc.documentElement.classList.contains('app-booting')" in source
    assert "Boolean(win.DesignEditorFocusedWorkspace)" not in source
    assert "markFrameReady('stable-workspace-probe')" in source
    assert "markFrameReady('load-stable-workspace')" in source
    assert "frameProbeTimer=setTimeout(probe,25)" in source
    assert "modular-design-stable-workspace-reveal-v2" in source


def test_design_modular_shell_suppresses_nested_auth_flash_after_parent_approval():
    source = read("js/studio-app-shell.js")
    assert "function prepareFrameForReveal()" in source
    assert "doc.documentElement.dataset.parentAccessApproved='true'" in source
    assert "doc.getElementById('authLoading')?.classList.add('hidden')" in source
    assert "if(frame)frame.style.visibility='hidden'" in source
    assert "frame.style.visibility='visible'" in source


def test_design_modular_shell_warms_shared_editor_assets_before_navigation():
    source = read("js/studio-app-shell.js")
    assert "const DESIGN_PRELOADS=[" in source
    assert "'/js/design-editor/presets.js?v=20260821-1'" in source
    assert "'/js/design-editor/app.js?v=20260821-1'" in source
    assert "'/js/design-editor/focused-professional-workspace.js?v=20260901-1'" in source
    assert "warmDesignAssets();expectedFrameUrl=" in source
    page = read("apps/index.html")
    assert 'rel="preconnect" href="https://www.gstatic.com"' in page
    assert 'rel="preconnect" href="https://cdn.jsdelivr.net"' in page
    assert '/js/studio-app-shell.js?v=20260901-6' in page


def test_home_exposes_one_combined_poster_flyer_program():
    source = read("js/home-program-catalog.js")
    assert "name:'포스터 · 전단지 제작'" in source
    assert "url:'/apps/poster'" in source
    assert "name:'포스터 제작'" not in source
    assert "name:'전단지 제작'" not in source
    assert "function isPosterFlyerProgram(p)" in source
    assert "if(!posterFlyerExpanded){out.push(COMBINED_POSTER_FLYER);posterFlyerExpanded=true;}" in source


def test_legacy_flyer_route_uses_the_combined_workspace():
    source = read("js/studio-app-shell.js")
    assert "poster:{title:'포스터 · 전단지 제작'" in source
    assert "flyer:{title:'포스터 · 전단지 제작'" in source
    assert source.count("surface=poster-flyer") >= 2


def test_combined_workspace_copy_is_owned_by_product_specific_module():
    source = read("js/design-editor/product-specific-workspace.js")
    assert "const combinedPosterFlyer=params.get('surface')==='poster-flyer';" in source
    assert "title:'포스터 · 전단지 디자인'" in source
    assert "section:'포스터 · 전단지 규격'" in source
