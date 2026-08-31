from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PREVIEW = ROOT / "js" / "pdf-editor" / "preview-insert-persistence.js"
SIDEBAR = ROOT / "js" / "pdf-editor" / "simple-sidebar-ui.js"
ROUTE = ROOT / "js" / "pdf-editor" / "route-runtime.js"
RUNNER = ROOT / "scripts" / "run_pdf_program_shell_smoke.sh"
SMOKE = ROOT / "tests" / "browser" / "pdf-preview-insert-persistence-smoke.html"


def test_multi_file_preview_restores_every_output_row_boundary_without_body_observer():
    source = PREVIEW.read_text(encoding="utf-8")

    for marker in (
        "function ensureNormalBoundaries()",
        "makePreviewInsertZone(index)",
        "pdf-preview-boundary-insert",
        "row.querySelectorAll(':scope>.page-preview').length",
        "observer.observe(scroll,{childList:true})",
        "timer=setTimeout(()=>{timer=0;repair();},0)",
        "multi-file-preview-insert-persistence-v2",
    ):
        assert marker in source

    assert "requestAnimationFrame" not in source
    assert "observer.observe(document.body" not in source
    assert "observer.observe(document.documentElement" not in source
    assert "subtree:true" not in source


def test_optimized_preview_keeps_blank_and_divider_fallback_without_duplicate_actions():
    source = PREVIEW.read_text(encoding="utf-8")

    for marker in (
        "function ensureFastFallback()",
        "scroll.querySelector('#pdfFastInsertActionsV1')",
        "blank.textContent='+ 빈 페이지'",
        "divider.textContent='+ 간지'",
        "window.openDividerInsert(parsedPages.length)",
    ):
        assert marker in source


def test_page_list_is_the_only_recovery_sidebar_section_allowed_to_collapse():
    source = SIDEBAR.read_text(encoding="utf-8")

    for marker in (
        '#thumbSection>#sb-pages.hidden{display:none!important}',
        "if(sec.id==='thumbSection')",
        "if(head.closest('#thumbSection'))",
        "single-sidebar-page-list-collapsible-hotfix-v4",
    ):
        assert marker in source

    assert "body.dataset.pdfSidebarMode='all-visible-page-list-collapsible'" in source


def test_route_and_browser_gate_include_insert_persistence_regression():
    route = ROUTE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")

    assert "/js/pdf-editor/preview-insert-persistence.js?v=20260831-2" in route
    assert "pdf-preview-insert-persistence-smoke.html" in runner
    assert "multi-file preview rerenders keep blank-page and divider insertion controls at every row boundary" in smoke
