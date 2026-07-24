from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
TOOLBAR = ROOT / "js" / "pdf-editor" / "preview-toolbar-layout-fix.js"
PDF_DOCK = ROOT / "js" / "pdf-editor" / "dock-width-align.js"


def test_preview_toolbar_fix_loads_after_all_pdf_layout_modules():
    loader = LOADER.read_text(encoding="utf-8")
    assert "preview-toolbar-layout-fix.js" in loader
    assert loader.rfind("preview-toolbar-layout-fix.js") > loader.rfind("dock-width-align.js")
    assert loader.rfind("preview-toolbar-layout-fix.js") > loader.rfind("individual-margins-facing-pages.js")


def test_preview_toolbar_first_row_is_vertically_aligned():
    toolbar = TOOLBAR.read_text(encoding="utf-8")
    assert 'grid-template-areas:"summary controls" "detail detail"' in toolbar
    assert 'grid-template-areas:"summary" "controls" "detail"' in toolbar
    assert "min-height:34px!important" in toolbar
    assert "align-items:center!important" in toolbar
    assert "bar.clientWidth < 520" in toolbar
    assert "width:92px!important" in toolbar
    assert "max-width:92px!important" in toolbar
    assert "countHint.parentElement !== bar" in toolbar
    assert "setInterval(" not in toolbar


def test_pdf_dock_is_flat_three_button_sidebar_bottom_area():
    pdf_dock = PDF_DOCK.read_text(encoding="utf-8")

    assert "pdf-flat-fixed-dock" in pdf_dock
    assert "bottom:0!important" in pdf_dock
    assert "border:0!important" in pdf_dock
    assert "border-radius:0!important" in pdf_dock
    assert "box-shadow:none!important" in pdf_dock
    assert "backdrop-filter:none!important" in pdf_dock
    assert "background:#fff!important" in pdf_dock
    assert "linear-gradient(90deg,#12396d,#2563eb,#1d9bb2)" in pdf_dock
    assert "grid-template-columns:repeat(3,minmax(0,1fr))" in pdf_dock
    assert "#previewBtn" in pdf_dock and "grid-column:1!important" in pdf_dock
    assert "#downloadBtn" in pdf_dock and "grid-column:2!important" in pdf_dock
    assert "#resetBtn" in pdf_dock and "grid-column:3!important" in pdf_dock
    assert "background:linear-gradient(135deg,#2563eb,#1d4ed8)" in pdf_dock
    assert "dock.querySelectorAll('.sec-head" in pdf_dock
    assert "작업 메뉴" not in pdf_dock
    assert "화면 고정" not in pdf_dock
    assert "aside.clientWidth" in pdf_dock
    assert "padding-left" in pdf_dock and "padding-right" in pdf_dock
    assert "setInterval(" not in pdf_dock
