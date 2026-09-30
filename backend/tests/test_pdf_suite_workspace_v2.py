from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_pdf_suite_uses_workspace_v2_assets_and_structure():
    index = read("pdf-suite/index.html")

    assert 'data-pdf-suite="workspace-v2"' in index
    assert '../css/pdf-suite-v2.css?v=20260930-1' in index
    assert '../js/pdf-suite/ui-v2.js?v=20260930-1' in index
    assert '../js/pdf-suite/local-tools.js?v=20260930-2' in index
    assert 'id="suiteSearch"' in index
    assert 'id="suiteCategoryTabs"' in index
    assert 'id="showPlanned"' in index
    assert 'id="suiteResultCount"' in index
    assert 'id="suiteZeroState"' in index
    assert 'id="futurePanel"' in index


def test_pdf_suite_preserves_local_processing_contract():
    index = read("pdf-suite/index.html")

    for required_id in (
        "local-tools",
        "localFile",
        "localDrop",
        "localFileNote",
        "localStatus",
        "localMetadata",
    ):
        assert f'id="{required_id}"' in index

    for action in ("rotate90", "rotate180", "reverse", "metadata", "sanitize", "flatten"):
        assert f'data-local-run="{action}"' in index

    # local-tools.js owns local execution; its legacy catalog filter must remain dormant
    # because the new workspace intentionally does not provide suiteFilters.
    assert 'id="suiteFilters"' not in index


def test_pdf_suite_exposes_all_primary_categories_and_routes():
    index = read("pdf-suite/index.html")

    for category in ("pages", "convert", "edit", "security", "print", "inspect"):
        assert f'data-category-filter="{category}"' in index
        assert f'data-category="{category}"' in index

    assert '../pdf-preflight/' in index
    assert '../pdf-editor/' in index
    assert '../print-checker/' in index
    assert 'data-status="available"' in index
    assert 'data-status="local"' in index
    assert 'data-status="planned"' in index
    assert 'planned hidden-tool' in index


def test_pdf_suite_ui_supports_search_tabs_and_progressive_disclosure():
    ui = read("js/pdf-suite/ui-v2.js")

    assert "window.__programStudioPdfSuiteUiV2" in ui
    assert "data-category-filter" in ui
    assert "aria-selected" in ui
    assert "showPlanned" in ui
    assert "suiteSearchClear" in ui
    assert "hidden-tool" in ui
    assert "hidden-section" in ui
    assert "suiteZeroState" in ui
    assert "pdf-suite-workspace-v2" in ui


def test_pdf_suite_css_is_responsive_and_task_focused():
    css = read("css/pdf-suite-v2.css")

    assert ".quick-grid{display:grid;grid-template-columns:repeat(6" in css
    assert ".tool-grid{display:grid;grid-template-columns:repeat(3" in css
    assert "@media(max-width:1120px)" in css
    assert "@media(max-width:760px)" in css
    assert "@media(max-width:520px)" in css
    assert ".tool-grid{grid-template-columns:1fr}" in css
    assert ".catalog-toolbar{position:sticky" in css
    assert ".hidden-tool,.hidden-section{display:none!important}" in css
