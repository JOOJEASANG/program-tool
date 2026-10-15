"""Regression guards against a perpetual preview loop after session restoration."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_focused_preview_observes_page_list_not_its_own_status_hint():
    source = (ROOT / "js/pdf-editor/layout-smooth-preview.js").read_text(encoding="utf-8")
    assert "if(hint.textContent!=='빠른 배치 미리보기 ON')" in source
    assert "bodyObserver.observe(area,{childList:true})" in source
    assert "bodyObserver.observe(document.body,{childList:true,subtree:true})" not in source


def test_restoring_saved_individual_margins_does_not_launch_second_preview():
    source = (ROOT / "js/pdf-editor/layout-export.js").read_text(encoding="utf-8")
    restore = source.split("const loadWithMargins = async function", 1)[1].split(
        "loadWithMargins.__individualMarginsV2", 1
    )[0]
    assert "applyStateMargins(state)" in restore
    assert "restorePageCellMargins(state)" in restore
    assert "requestPreview();" not in restore


def test_browser_smoke_covers_loaded_editing_session_stability():
    page = (ROOT / "tests/browser/pdf-session-preview-stability-smoke.html").read_text(encoding="utf-8")
    smoke = (ROOT / "scripts/run_pdf_program_shell_smoke.sh").read_text(encoding="utf-8")
    assert "data-pdf-session-preview-stability" in page
    assert "history.replaceState({}, '', '/pdf-editor/" in page
    assert "pdf-session-preview-stability-smoke.html" in smoke


def test_windowed_preview_marks_141_page_job_complete_for_legacy_watchdog():
    lazy = (ROOT / "js/pdf-editor/viewport-lazy-preview.js").read_text(encoding="utf-8")
    editor = (ROOT / "pdf-editor/index.html").read_text(encoding="utf-8")
    smoke = (ROOT / "scripts/run_pdf_program_shell_smoke.sh").read_text(encoding="utf-8")
    assert "window._markPreviewShown(parsedPages.length)" in lazy
    assert "if (byId('previewBtn')) byId('previewBtn').disabled = true;" in lazy
    assert "LARGE_RESTORED_PAGE_THRESHOLD = 120" in lazy
    assert "LARGE_RESTORED_WINDOW_RADIUS = 1" in lazy
    assert "window._markPreviewShown = function(n)" in editor
    assert "timer = setTimeout(() => ensurePreview(attempt, token), 350)" in editor
    manual = (ROOT / "js/program-manuals/pdf-editor.js").read_text(encoding="utf-8")
    assert "120페이지 이상 저장본" in manual
    assert "pdf-141-page-lazy-preview-smoke.html" in smoke
