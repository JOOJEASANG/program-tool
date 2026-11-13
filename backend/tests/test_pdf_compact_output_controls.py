"""Compact PDF left-sidebar output actions keep the existing PDF engines."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_two_rows_of_compact_actions_replace_stacked_preflight_block():
    sidebar = read("js/pdf-editor/simple-sidebar-ui.js")
    final = read("js/pdf-editor-final-check.js")
    html = read("pdf-editor/index.html")
    for marker in (
        "grid-template-columns:minmax(0,1.04fr) minmax(0,1.20fr) minmax(0,.87fr)",
        "grid-column:1/-1!important;grid-row:1!important",
        "#pdfEditorFinalCheckBtn{",
        "grid-column:2!important;grid-row:2!important",
        "grid-column:3!important;grid-row:2!important",
        "display:contents!important",
        "display:none!important",
        "background:#91a6be!important",
        "color:#fff!important",
    ):
        assert marker in sidebar
    for marker in ('id="downloadBtn"', 'id="previewBtn"', 'id="resetBtn"'):
        assert marker in html
    assert 'id="pdfEditorFinalCheckBtn"' in final
    assert "download.textContent='PDF 저장';" in final
    assert "'검사 중…':'검사 후 저장'" in final
    assert "aria-label=\"인쇄 전 검사 후 PDF 저장\"" in final
    assert "pefc-hint" not in final and "pefc-direct-note" not in final


def test_main_handlers_keep_existing_behavior_and_browser_regression_is_required():
    html = read("pdf-editor/index.html")
    final = read("js/pdf-editor-final-check.js")
    runner = read("scripts/run_pdf_program_shell_smoke.sh")
    browser = read("tests/browser/pdf-compact-output-controls-smoke.html")
    for marker in ("$('previewBtn').addEventListener('click', triggerPreview)",
                   "$('downloadBtn').addEventListener('click'",
                   "$('resetBtn').addEventListener('click'"):
        assert marker in html
    assert "download.insertAdjacentElement('beforebegin',wrap);" in final
    assert "addEventListener('click',runFinalCheck)" in final
    assert "pdf-compact-output-controls-smoke.html" in runner
    assert "getBoundingClientRect().height>115" in browser
    assert "disabled action labels lack white high-contrast text" in browser
    assert "preflight modal failed to open" in browser
    for path in ("js/pdf-editor/simple-sidebar-ui.js", "js/pdf-editor-final-check.js"):
        proc = subprocess.run(["node", "--check", str(ROOT/path)], cwd=ROOT, capture_output=True, text=True)
        assert proc.returncode == 0, proc.stdout+proc.stderr


def test_assets_and_cache_versions_are_consistent():
    assert "simple-sidebar-ui.js?v=20261112-3" in read("js/pdf-editor/ui-runtime.js")
    assert "pdf-editor-final-check.js?v=20261112-2" in read("js/pdf-editor/route-runtime.js")
    assert "PDF_UI_RUNTIME_VERSION='20261112-2'" in read("js/program-shell-unify.js")
    assert '"version": "2026.11.13.001"' in read("version.json")
