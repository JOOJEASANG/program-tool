"""Regression checks for all eight canonical Program Studio UI entrypoints."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCREEN_FILES = {
    "index.html": "home",
    "print-checker/index.html": "print-checker",
    "smart-print-layout/index.html": "smart-print",
    "pdf-editor/index.html": "pdf-layout",
    "pdf-editor-advanced/index.html": "pdf-edit",
    "ai-design-maker/index.html": "ai-cover",
    "pdf-suite/index.html": "pdf-tools",
    "pdf-preflight/index.html": "preflight",
}
ASSET = "/css/program-suite-ux-20261116.css?v=20261116-1"


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_every_active_program_loads_shared_ux_and_has_a_scoped_selector():
    styles = read("css/program-suite-ux-20261116.css")
    assert "color-scheme:light" in styles
    assert "prefers-reduced-motion" in styles
    assert ":focus-visible" in styles
    for file, screen in SCREEN_FILES.items():
        html = read(file)
        assert f'data-suite-screen="{screen}"' in html, file
        assert html.count(ASSET) == 1, file
        assert f'html[data-suite-screen="{screen}"]' in styles, screen


def test_new_rules_do_not_override_pdf_processing_or_geometry():
    style = read("css/program-suite-ux-20261116.css")
    assert "canvas.width" not in style
    assert "page.rotation" not in style
    assert "apiProcessPdf" not in style
    assert ".control-section[open]>summary::after" in style
    assert 'content:"펼치기"' in style
    assert 'content:"접기"' in style


def test_home_mobile_navigation_has_escape_and_focus_recovery():
    html = read("index.html")
    assert "function setSidebarOpen(open,restoreFocus=false)" in html
    assert "if(event.key==='Escape'&&sidebar.classList.contains('open'))" in html
    assert "menuToggle.focus()" in html


def test_mobile_browser_smoke_is_in_required_ci():
    smoke = read("scripts/run_phase6_browser_smoke.sh")
    assert "program-suite-unified-ux-smoke.html" in smoke
    fixture = read("tests/browser/program-suite-unified-ux-smoke.html")
    assert 'data-program-suite-ux-smoke="running"' in fixture
    assert "getComputedStyle(summary,'::after').content" in fixture
    assert "root.dataset.suiteScreen='pdf-edit'" in fixture
    assert "root.dataset.suiteScreen='preflight'" in fixture
