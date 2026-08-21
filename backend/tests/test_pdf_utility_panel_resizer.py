from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RESIZER = ROOT / "js" / "pdf-utility-panel-resizer.js"
APP_VERSION = ROOT / "js" / "app-version.js"


def test_pdf_utility_panel_resizer_has_equal_default_and_drag_limits():
    source = RESIZER.read_text(encoding="utf-8")
    for marker in (
        "const MIN=0.30;",
        "const MAX=0.70;",
        "return Number.isFinite(raw)?clamp(raw):0.5;",
        "pointerdown",
        "pointermove",
        "pointerup",
        "localStorage",
    ):
        assert marker in source


def test_pdf_utility_panel_resizer_targets_workspace_and_responsive_layout():
    source = RESIZER.read_text(encoding="utf-8")
    for marker in (
        "pdfu-resizable-workspace",
        "pdfu-panel-resizer",
        "grid-template-columns:minmax(0,calc((100% - ${GAP}px - ${HANDLE}px) * var(--pdfu-left-ratio, .5))) ${HANDLE}px minmax(0,1fr)!important",
        "@media(max-width:1050px)",
        "display:none!important",
    ):
        assert marker in source


def test_pdf_utility_panel_resizer_is_loaded_on_pdf_utility_routes():
    source = APP_VERSION.read_text(encoding="utf-8")
    assert "pdfUtilityPanelResizerScriptV1" in source
    assert "/js/pdf-utility-panel-resizer.js?v=20260821-1" in source
