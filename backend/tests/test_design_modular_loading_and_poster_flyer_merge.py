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
    assert "modular-app-shell-product-context-v6-functional-reveal" in source
    assert "modular-app-shell-parallel-engine-preload-v2" in source


def test_design_modular_shell_reveals_only_after_functional_project_readiness():
    source = read("js/studio-app-shell.js")
    assert "function designFrameCanReveal()" in source
    assert "win.DesignEditorApp?.project" in source
    assert "doc.documentElement.dataset.designEmbeddedProjectReady==='1'" in source
    reveal = source[source.index("function designFrameCanReveal()") : source.index("function startFrameProbe()")]
    assert "designFocusedWorkspace" not in reveal
    assert "!doc.documentElement.classList.contains('app-booting')" in source
    assert "Boolean(win.DesignEditorFocusedWorkspace)" not in source
    assert "markFrameReady('functional-project-probe')" in source
    assert "markFrameReady('load-functional-project')" in source
    assert "frameProbeTimer=setTimeout(probe,40)" in source
    assert "modular-design-functional-project-reveal-v4" in source


def test_design_modular_shell_accepts_internal_general_route_rewrite_without_wait_race():
    source = read("js/studio-app-shell.js")
    assert "'/design-editor/index.html'" in source
    assert "const designPaths=new Set" in source
    assert "current.searchParams.get('embed')==='1'" in source
    assert "currentMode===expectedMode" in source


def test_design_modular_shell_suppresses_nested_auth_flash_after_parent_approval():
    source = read("js/studio-app-shell.js")
    assert "function prepareFrameForReveal()" in source
    assert "doc.documentElement.dataset.parentAccessApproved='true'" in source
    assert "doc.getElementById('authLoading')?.classList.add('hidden')" in source
    assert "if(frame)frame.style.visibility='hidden'" in source
    assert "frame.style.visibility='visible'" in source


def test_design_modular_shell_warms_only_base_editor_assets_before_navigation():
    source = read("js/studio-app-shell.js")
    assert "const DESIGN_PRELOADS=[" in source
    preloads = source.split("const DESIGN_PRELOADS=[", 1)[1].split("];", 1)[0]
    assert "'/js/design-editor/embedded-stability-bootstrap.js?v=20260901-1'" in preloads
    assert "'/js/design-editor/presets.js?v=20260821-1'" in preloads
    assert "'/js/design-editor/app.js?v=20260821-1'" in preloads
    assert "focused-professional-workspace.js" not in preloads
    assert "warmDesignAssets();expectedFrameUrl=" in source


def test_home_design_programs_enter_shared_editor_directly_without_apps_iframe_shell():
    source = read("js/home-program-catalog.js")
    assert "const DIRECT_DESIGN_BASE='/design-editor/general?embed=1';" in source
    assert "name:'표지 제작'" in source and "app=cover&entry=direct" in source
    assert "name:'포스터 · 전단지 제작'" in source
    assert "app=poster&surface=poster-flyer&entry=direct" in source
    assert "app=invitation&entry=direct" in source
    assert "app=invitation&surface=notice&entry=direct" in source
    assert "app=leaflet&entry=direct" in source
    assert "modular-production-apps-home-catalog-v5-direct-design-entry" in source


def test_home_exposes_one_combined_poster_flyer_program():
    source = read("js/home-program-catalog.js")
    assert "name:'포스터 · 전단지 제작'" in source
    assert "name:'포스터 제작'" not in source
    assert "name:'전단지 제작'" not in source
    assert "function isPosterFlyerProgram(p)" in source
    assert "app==='poster'||app==='flyer'" in source
    assert "if(!posterFlyerExpanded){out.push(COMBINED_POSTER_FLYER);posterFlyerExpanded=true;}" in source


def test_legacy_design_app_routes_redirect_before_modular_shell_or_firebase_boot():
    page = read("apps/index.html")
    # Routes now redirect to the unified print-checker tool
    assert "/print-checker?product=" in page
    for key in ("cover", "flyer", "invitation", "leaflet"):
        assert key in page
    redirect_marker = "location.replace"
    assert redirect_marker in page
    assert page.index(redirect_marker) < page.index("data-program-studio-boot-guard")
    assert page.index(redirect_marker) < page.index("firebase-app-compat.js")


def test_legacy_flyer_shell_configuration_still_uses_combined_workspace_as_fallback():
    source = read("js/studio-app-shell.js")
    assert "poster:{title:'포스터 · 전단지 제작'" in source
    assert "flyer:{title:'포스터 · 전단지 제작'" in source
    assert source.count("surface=poster-flyer") >= 2


def test_combined_workspace_copy_is_owned_by_product_specific_module():
    source = read("js/design-editor/product-specific-workspace.js")
    assert "const combinedPosterFlyer=params.get('surface')==='poster-flyer';" in source
    assert "title:'포스터 · 전단지 디자인'" in source
    assert "section:'포스터 · 전단지 규격'" in source