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
