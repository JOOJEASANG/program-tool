"""The home header exposes only quick launch; sidebar retains session controls."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_home_header_has_only_the_quick_launch_mount_point():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    head = html.split('<header class="topbar">', 1)[1].split('</header>', 1)[0]
    assert '<div class="topbar-right" aria-label="빠른 실행"></div>' in head
    assert 'id="tbLogin"' not in head
    assert 'id="tbUser"' not in head
    assert 'id="tbAdmin"' not in head
    assert 'id="sbUser"' in html
    assert 'id="sbLogout"' in html
    assert 'id="sbAdmin" href="admin.html"' in html
    assert "if(access.admin)document.getElementById('sbAdmin').classList.remove('hidden')" in html
    assert "document.getElementById('tbUser')" not in html
    assert "document.getElementById('tbLogin')" not in html


def test_quick_launch_remains_keyboard_operable_and_refined():
    script = (ROOT / "js/program-studio-ui-v2.js").read_text(encoding="utf-8")
    css = (ROOT / "css/studio-workspace.css").read_text(encoding="utf-8")
    smoke = (ROOT / "scripts/run_pdf_program_shell_smoke.sh").read_text(encoding="utf-8")
    assert "ps-command-trigger ps-tool-switch ps-home-quick-launch" in script
    assert "button.addEventListener('click',openPalette)" in script
    assert "event.ctrlKey||event.metaKey" in script
    assert "String(event.key).toLowerCase()==='k'" in script
    assert "ps-quick-launch-icon" in script
    assert "ps-quick-launch-label" in script
    assert "body[data-home-suite] .topbar-right .ps-home-quick-launch" in css
    assert "body[data-home-suite] .ps-home-quick-launch .ps-quick-launch-icon" in css
    assert "@media(max-width:520px)" in css
    assert "home-quick-launch-header-smoke.html" in smoke
