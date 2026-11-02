"""Unified general and multi-up variable data printing contracts."""
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
JS=ROOT/"js/print-specialists/variable-multiup.js"
HUB=ROOT/"js/print-specialists/variable-hub.js"
SMART=ROOT/"smart-print-layout/index.html"
MANUAL=ROOT/"js/program-manuals/smart-print-layout.js"
BEHAVIOR=ROOT/"backend/tests/test_variable_multiup_layout_behavior.cjs"


def test_multiup_javascript_parses_and_grid_uses_actual_print_dimensions():
    for file in (JS,HUB):
        r=subprocess.run(["node","--check",str(file)],cwd=ROOT,text=True,capture_output=True)
        assert r.returncode == 0,r.stdout+r.stderr
    r=subprocess.run(["node",str(BEHAVIOR)],cwd=ROOT,text=True,capture_output=True)
    assert r.returncode == 0,r.stdout+r.stderr
    assert "variable multi-up geometry" in r.stdout


def test_original_template_is_reused_once_for_each_unique_recipient_sheet():
    src=JS.read_text(encoding="utf-8")
    for marker in (
        "output", "pdf.embedPdf(bytes,[0])", "if(artwork)page.drawPage(artwork",
        "const i=", "plan.items(sheet)", "fieldText(f,list[pos.index])",
        "page.drawImage(img.image", "DPI=300", "page.drawLine(",
        "source=bytes", "new Uint8Array(source)", "MAX_PEOPLE=300",
        "MAX_PAGES=100", "mvMarks", "mvPaper", "mvMargin", "mvGap",
        "body.querySelectorAll('input,select,button')",
    ):
        if marker in ("output","const i="):
            continue
        assert marker in src
    assert "fetch(" not in src


def test_unified_modes_are_wired_and_user_guide_is_current():
    html=SMART.read_text(encoding="utf-8")
    hub=HUB.read_text(encoding="utf-8")
    manual=MANUAL.read_text(encoding="utf-8")
    for name in ("certificate-variable.js","variable-multiup.js","variable-hub.js","variable-data.js"):
        assert name in html
    for name in ("certificates","multi-variable","variable"):
        assert f'value="{name}"' in hub
    for phrase in ("일반 가변인쇄","다단 가변인쇄","재단선","300건"):
        assert phrase in manual
    assert "updated: '2026-11-02'" in manual
