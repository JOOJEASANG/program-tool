"""PDF layout page thumbnails must be a single right-side editor panel."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
EDITOR = ROOT / "pdf-editor/index.html"
JS = ROOT / "js/pdf-editor/page-sidebar.js"
MANUAL = ROOT / "js/program-manuals/pdf-editor.js"
BROWSER = ROOT / "tests/browser/pdf-editor-right-sidebar-smoke.html"
RUNNER = ROOT / "scripts/run_pdf_program_shell_smoke.sh"


def test_pdf_page_list_has_moved_to_right_of_preview_without_duplication():
    source = EDITOR.read_text(encoding="utf-8")
    assert source.count('id="thumbSection"') == 1
    assert source.count('id="thumbArea"') == 1
    assert source.count('id="slideCount"') == 1
    assert source.count('id="pageSidebar"') == 1
    main_end = source.index("</main>")
    right_start = source.index('<aside id="pageSidebar"', main_end)
    right_end = source.index("</aside>", right_start)
    assert main_end < right_start < source.index('id="thumbSection"') < right_end
    assert source.index('id="sb-upload"') < main_end
    assert source.index('id="sb-nup"') < main_end
    assert source.index('id="sb-pages"') > right_start
    assert 'id="pageSidebarToggle"' in source
    assert 'id="pageSidebarResize"' in source
    assert 'id="pageSidebarBackdrop"' in source
    assert 'page-sidebar-open' in source
    assert 'grid-template-columns:360px minmax(0,1fr) var(--page-sidebar-width)!important' in source
    assert 'pdf-editor/page-sidebar.js?v=20261106-1' in source


def test_right_panel_keeps_existing_thumbnail_editing_dom_hooks():
    source = EDITOR.read_text(encoding="utf-8")
    script = JS.read_text(encoding="utf-8")
    for marker in (
        "MutationObserver(syncPageState)",
        "section.style.display!=='none'",
        "app.classList.toggle('page-sidebar-open',open)",
        "sidebar.inert=!open",
        "toggle.setAttribute('aria-expanded'",
        "grip.setPointerCapture",
        "localStorage.setItem(STORAGE_WIDTH",
        "pageSidebarBackdrop",
        "if(pages&&!hadPages&&!manuallyClosed&&wide())setOpen(true)",
        "if(!pages&&hadPages){manuallyClosed=false;setOpen(false);}",
    ):
        assert marker in script
    for marker in ("function renderThumbs(", "thumbArea", "thumbSection", "schedulePreview"):
        assert marker in source
    assert 'data-sec="pages"' in source
    assert 'id="pageSidebarClose"' in source
    assert 'id="pageSidebarEmpty"' in source
    assert 'max-width:1180px' in source
    assert 'max-width:980px' in source


def test_right_panel_script_parses_and_manual_browser_check_updated():
    r = subprocess.run(["node", "--check", str(JS)], capture_output=True, text=True, cwd=ROOT)
    assert r.returncode == 0, r.stdout + r.stderr
    manual = MANUAL.read_text(encoding="utf-8")
    assert "updated: '2026-11-12'" in manual
    assert "오른쪽 페이지 목록" in manual
    assert "왼쪽 페이지 목록" not in manual
    assert "tests/browser/pdf-editor-right-sidebar-smoke.html" == "tests/browser/" + BROWSER.name
    runner = RUNNER.read_text(encoding="utf-8")
    assert BROWSER.name in runner
    assert 'data-pdf-right-sidebar-smoke="pass"' in runner
