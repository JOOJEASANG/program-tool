"""Regression checks for the PDF editor preview toolbar."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
EDITOR = ROOT / "pdf-editor" / "index.html"


def test_preview_toolbar_controls_share_36px_height():
    source = LOADER.read_text(encoding="utf-8")
    styles = source.split("style.textContent = `", 1)[1].split("`;", 1)[0]

    assert ".preview-info button," in styles
    assert ".preview-info select," in styles
    assert '.preview-info input[type="number"],' in styles
    assert ".preview-zoom .zoom-label {" in styles
    for declaration in (
        "height: 36px !important;",
        "min-height: 36px !important;",
        "max-height: 36px !important;",
        "#previewPages:not(:empty)",
        "#previewPages:empty",
        "#zoomResetBtn",
        ".preview-zoom .zoom-btn:not(#zoomResetBtn)",
    ):
        assert declaration in styles


def test_preview_toolbar_remains_accessible_when_narrow():
    source = LOADER.read_text(encoding="utf-8")
    assert "overflow-x: auto !important;" in source
    assert "@media (max-width: 900px)" in source
    assert "flex-wrap: wrap !important;" in source
    markup = EDITOR.read_text(encoding="utf-8")
    for id_ in ("perRowSelect", "zoomOutBtn", "zoomLabel", "zoomInBtn", "zoomResetBtn"):
        assert f'id="{id_}"' in markup


def test_uploaded_pdf_navigation_uses_same_height_as_zoom_and_fit():
    source = (ROOT / "js" / "pdf-editor" / "layout-ui-refinements.js").read_text(encoding="utf-8")
    assert "#pdfLazyPreviewNav button{box-sizing:border-box!important;height:36px!important;" in source
    assert "#pdfLazyPreviewNav input{box-sizing:border-box!important;height:36px!important;" in source
    assert "#pdfLazyPreviewNav .lazy-preview-count{display:inline-flex!important;align-items:center!important;min-height:36px!important;" in source
    assert "#zoomResetBtn{height:36px!important;min-height:36px!important;max-height:36px!important;" in source
    assert "height:27px!important" not in source
