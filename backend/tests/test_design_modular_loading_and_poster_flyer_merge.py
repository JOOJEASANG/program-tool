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
