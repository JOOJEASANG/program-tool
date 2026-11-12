"""Selected-page content margins from the PDF layout right sidebar."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
EDITOR = ROOT / "pdf-editor/index.html"
RIGHT = ROOT / "js/pdf-editor/page-sidebar.js"
PANEL = ROOT / "js/pdf-editor/page-selected-margins.js"
ENGINE = ROOT / "js/pdf-editor/layout-export.js"
CORE = ROOT / "js/pdf-editor/core-runtime.js"
LOADER = ROOT / "js/pdf-editor/loader.js"
MANUAL = ROOT / "js/program-manuals/pdf-editor.js"
RUNNER = ROOT / "scripts/run_pdf_program_shell_smoke.sh"


def test_right_sidebar_default_width_increased_without_reducing_preview_too_far():
    html = EDITOR.read_text(encoding="utf-8")
    script = RIGHT.read_text(encoding="utf-8")
    assert "--page-sidebar-width:360px" in html
    assert 'aria-valuemin="280" aria-valuemax="480" aria-valuenow="360"' in html
    assert "width:min(400px,calc(100vw - 20px))" in html
    assert "DEFAULT_WIDTH=360,MIN_WIDTH=280,MAX_WIDTH=480" in script
    assert "Math.max(DEFAULT_WIDTH,legacy||0)" in script
    assert "window.innerWidth-360-480" in script
    assert "width=clampWidth(saved>0?saved:" in script


def test_page_selection_does_not_change_unselected_source_content_margins():
    script = ENGINE.read_text(encoding="utf-8")
    for marker in (
        "function applySelectedPageMargins(changes = {}, reset = false)",
        "const targets = selectedSourcePages();",
        "Object.prototype.hasOwnProperty.call(changes, edge)",
        "Number.isFinite(value) || value < 0 || value > 80",
        "page.cellMargins = { ...pageCellMarginOverrides(page), ...values };",
        "delete page.cellMargins;",
        "syncPageCellMarginUi();",
        "requestPreview();",
        "'pdf-page-margin-change'",
        "applySelectedPageMargins,",
        "window.PdfEditorPageSelection?.snapshotSelectedIds?.()",
        "state.pageCellMargins = sourcePages().map",
        "settings.pages = settings.pages.map",
    ):
        assert marker in script


def test_selected_page_margin_panel_uses_exact_same_engine_and_has_mixed_state():
    html = EDITOR.read_text(encoding="utf-8")
    ui = PANEL.read_text(encoding="utf-8")
    for edge in ("Left", "Right", "Top", "Bottom"):
        assert 'id="pageSelectedMargin' + edge + '"' in html
    for marker in (
        'id="pageSelectedMarginPanel"',
        'id="pageSelectedMarginApply"',
        'id="pageSelectedMarginReset"',
        'id="pageSelectedMarginCount"',
        'id="pageSelectedMarginStatus"',
        'page-selected-margins.js?v=20261112-1',
    ):
        assert marker in html
    for marker in (
        "window.PdfEditorLayoutExport",
        "api()?.selectedSourcePages?.()",
        "engine.marginValues()",
        "engine.pageCellMargins(page,globals)[edge]",
        "fields[edge].placeholder=same?'mm':'혼합'",
        "const dirty=new Set()",
        "const changes={};",
        "for(const edge of dirty)",
        "engine.applySelectedPageMargins(changes)",
        "engine.applySelectedPageMargins({},true)",
        "'pdf-page-selection-change'",
        "'pdf-page-margin-change'",
        "document.addEventListener('input',onGlobalChange,true)",
        "document.addEventListener('change',onGlobalChange,true)",
        "const globalEdges=new Set(['marginLeft','marginRight','marginTop','marginBottom','marginH','marginV'])",
    ):
        assert marker in ui
    assert "layout-export.js?v=20261112-1" in CORE.read_text(encoding="utf-8")
    assert "layout-export.js?v=20261112-1" in LOADER.read_text(encoding="utf-8")


def test_browser_regression_and_manual_cover_selected_only_and_global_reset():
    runner = RUNNER.read_text(encoding="utf-8")
    manual = MANUAL.read_text(encoding="utf-8")
    assert "pdf-selected-page-margins-smoke.html" in runner
    assert 'data-pdf-selected-page-margins-smoke="pass"' in runner
    for marker in ("기본 폭을 300px에서 360px", "개별 여백", "혼합", "개별 여백 초기화"):
        assert marker in manual
    for file in (RIGHT, PANEL, ENGINE):
        check = subprocess.run(["node", "--check", str(file)], text=True, capture_output=True, cwd=ROOT)
        assert check.returncode == 0, check.stderr
