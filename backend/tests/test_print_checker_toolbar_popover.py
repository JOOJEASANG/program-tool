from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "print-checker" / "index.html"
SUMMARY_CLEANUP = ROOT / "js" / "print-checker" / "live-summary-cleanup.js"
POPOVER = ROOT / "js" / "print-checker" / "leaflet-layout-popover.js"
POPOVER_CSS = ROOT / "css" / "print-checker-leaflet-popover.css"
BROWSER = ROOT / "tests" / "browser" / "print-checker-product-transition-smoke.html"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_legacy_live_summary_is_kept_out_of_preview_canvas_even_with_cached_defaults_live():
    index = text(INDEX)
    cleanup = text(SUMMARY_CLEANUP)

    cleanup_src = "/js/print-checker/live-summary-cleanup.js?v=20260911-1"
    defaults_src = "/js/print-checker/defaults-live.js?v=20260911-2"
    assert cleanup_src in index
    assert defaults_src in index
    assert index.index(cleanup_src) < index.index(defaults_src)

    assert "const SUMMARY_ID = 'printCheckerLiveSummary'" in cleanup
    assert "display:none!important" in cleanup
    assert "document.body.appendChild(summary)" in cleanup
    assert "summary.hidden = true" in cleanup
    assert "summary.dataset.legacySummaryDisabled = '1'" in cleanup
    assert "printCheckerLiveSummary = 'disabled'" in cleanup


def test_leaflet_page_layout_moves_to_center_toolbar_hover_layer():
    index = text(INDEX)
    popover = text(POPOVER)
    css = text(POPOVER_CSS)

    assert "/css/print-checker-leaflet-popover.css?v=20260911-1" in index
    assert "/js/print-checker/leaflet-layout-popover.js?v=20260911-1" in index
    assert "leafletLayoutPopoverButton" in popover
    assert "페이지 배치 보기" in popover
    assert "leafletLayoutPopoverLayer" in popover
    assert "guide.parentElement !== layer" in popover
    assert "layer.appendChild(guide)" in popover
    assert "mouseenter" in popover
    assert "mouseleave" in popover
    assert "focusin" in popover
    assert "focusout" in popover
    assert "event.key === 'Escape'" in popover
    assert "currentProduct() !== 'leaflet'" in popover
    assert "v1-toolbar-hover-layer" in popover

    assert "grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)" in css
    assert "#coverLiveDimensions" in css and "grid-column:1" in css
    assert ".pc-leaflet-layout-popover-wrap" in css and "grid-column:2" in css
    assert ".pc-preview-zoom-controls" in css and "grid-column:3" in css
    assert ".pc-leaflet-layout-popover-layer" in css
    assert "position:absolute" in css


def test_browser_smoke_covers_hidden_summary_and_leaflet_hover_popover():
    browser = text(BROWSER)

    assert "legacySummaryClean" in browser
    assert "legacySummary.parentElement===document.body" in browser
    assert "!canvasWrap.contains(legacySummary)" in browser
    assert "popoverOpen" in browser
    assert "popoverClosed" in browser
    assert "new MouseEvent('mouseenter'" in browser
    assert "new MouseEvent('mouseleave'" in browser
    assert "leafletGuide.parentElement===popoverLayer" in browser
    assert "zoomControls?.parentElement===zoomToolbar" in browser
    assert "canvasDimensionClean" in browser
