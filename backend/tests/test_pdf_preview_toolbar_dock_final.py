from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
TOOLBAR = ROOT / "js" / "pdf-editor" / "preview-toolbar-layout-fix.js"
PDF_DOCK = ROOT / "js" / "pdf-editor" / "dock-width-align.js"
COVER_DOCK = ROOT / "js" / "cover-floating-action-dock.js"


def test_preview_toolbar_fix_loads_after_all_pdf_layout_modules():
    loader = LOADER.read_text(encoding="utf-8")
    assert "preview-toolbar-layout-fix.js" in loader
    assert loader.rfind("preview-toolbar-layout-fix.js") > loader.rfind("dock-width-align.js")
    assert loader.rfind("preview-toolbar-layout-fix.js") > loader.rfind("individual-margins-facing-pages.js")


def test_preview_toolbar_has_compact_non_overlapping_layout():
    toolbar = TOOLBAR.read_text(encoding="utf-8")
    assert 'grid-template-areas:"copy controls"' in toolbar
    assert 'grid-template-areas:"copy" "controls"' in toolbar
    assert 'grid-template-areas:"info pages live" "count count count"' in toolbar
    assert 'grid-template-areas:"info pages" "live live" "count count"' in toolbar
    assert "bar.clientWidth < 760" in toolbar
    assert "width:96px!important" in toolbar
    assert "max-width:96px!important" in toolbar
    assert "position:static!important" in toolbar
    assert "preview-copy-primary" not in toolbar
    assert "preview-copy-secondary" not in toolbar
    assert "setInterval(" not in toolbar


def test_pdf_dock_uses_book_cover_fixed_layout_without_legacy_dimensions():
    pdf_dock = PDF_DOCK.read_text(encoding="utf-8")
    cover_dock = COVER_DOCK.read_text(encoding="utf-8")

    for shared in (
        "bottom:12px!important",
        "border-radius:16px!important",
        "box-shadow:0 18px 48px",
        "backdrop-filter:blur(16px)",
        "linear-gradient(90deg,#12396d,#2563eb,#1d9bb2)",
        "화면 고정",
        "sidebar.clientWidth - paddingLeft - paddingRight",
    ):
        assert shared in pdf_dock
        assert shared in cover_dock

    assert "pdf-book-cover-dock" in pdf_dock
    assert "classList.remove('pdf-output-floating'" in pdf_dock
    assert "#downloadBtn" in pdf_dock and "grid-column:1/-1" in pdf_dock
    assert "setInterval(" not in pdf_dock
