from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def source(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_home_catalog_normalizes_separate_poster_and_flyer_entries() -> None:
    catalog = source("js/home-program-catalog.js")
    assert "function isPosterFlyerProgram(p)" in catalog
    assert "u.endsWith('/apps/poster')" in catalog
    assert "u.endsWith('/apps/flyer')" in catalog
    assert "if(!posterFlyerExpanded){out.push(COMBINED_POSTER_FLYER);posterFlyerExpanded=true;}" in catalog
    assert "if(!samePrograms(next,category.programs))" in catalog
    assert "modular-production-apps-home-catalog-v4-remote-poster-flyer-normalized" in catalog


def test_modular_app_shell_preloads_engine_while_access_remains_gated() -> None:
    shell = source("js/studio-app-shell.js")
    assert "let accessGranted=false;" in shell
    assert "let frameReady=false;" in shell
    assert "function maybeReady(){if(accessGranted&&frameReady)ready();}" in shell
    assert "document.documentElement.dataset.modularAppEnginePreload='started'" in shell
    assert "if(!accessGranted||!frameReady)return;" in shell
    assert "parallelStage:'modular-app-shell-parallel-engine-preload-v1'" in shell
    assert shell.index("load();\n  if(document.readyState") < shell.index("window.ProgramStudioModularAppShell=")


def test_modular_app_page_starts_shell_before_deferred_firebase_access_scripts() -> None:
    page = source("apps/index.html")
    shell_tag = '<script defer src="/js/studio-app-shell.js?v=20260901-7"></script>'
    firebase_tag = '<script defer data-program-studio-approval-bootstrap src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>'
    access_tag = '<script defer src="/js/modular-app-access.js?v=20260901-2"></script>'
    assert shell_tag in page
    assert firebase_tag in page
    assert access_tag in page
    assert page.index(shell_tag) < page.index(firebase_tag) < page.index(access_tag)
    assert '<script src="/js/studio-app-shell.js?v=20260901-4"></script>' not in page
