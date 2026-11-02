"""Preview output must preserve original imported PDF orientation."""
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
EDITOR=ROOT/"pdf-editor/index.html"
BEHAVIOR=ROOT/"backend/tests/test_pdf_layout_upload_orientation_behavior.cjs"
CERT=ROOT/"js/print-specialists/certificate-variable.js"
SMART=ROOT/"smart-print-layout/index.html"


def test_normal_pdf_import_has_explicit_no_rotation_source_marker():
    src=EDITOR.read_text(encoding="utf-8")
    assert "canvas.dataset.pdfAutoFitRotation = 'disabled'" in src
    assert "src?.dataset?.pdfAutoFitRotation !== 'disabled'" in src
    assert "const rot = src?.dataset?.pdfAutoFitRotation !== 'disabled' && s90 > s0 * 1.10;" in src


def test_preview_drawing_executes_rotation_guard():
    result=subprocess.run(["node",str(BEHAVIOR)],cwd=ROOT,capture_output=True,text=True)
    assert result.returncode == 0,result.stdout+result.stderr
    assert "PDF layout upload orientation behavior passed" in result.stdout


def test_certificate_mode_is_separate_from_standard_business_card_vdp():
    smart=SMART.read_text(encoding="utf-8")
    cert=CERT.read_text(encoding="utf-8")
    assert 'certificate-variable.js?v=20261102-2' in smart
    assert 'variable-multiup.js?v=20261102-1' in smart
    assert 'variable-hub.js?v=20261102-1' in smart
    assert 'variable-data.js?v=20261028-1' in smart
    for snippet in (
        "ui.register('certificates'", "cvPdf", "cvRoster", "cvColumn",
        "cvPerson", "cvRun", "cvMode", "cvPreview", "cvCancel",
        "가변데이터 자동인쇄 · 일반/다단", "sourceDoc", "pdfjsLib.getDocument",
        "window.XLSX.read", "sheet_to_json", "localStorage.setItem",
        "ctx.library('pdf')", "output.embedPage(original.getPage(0),exportBox",
        "output.embedPng", "dpi=300", "MAX_PEOPLE=300",
        "가변데이터_일반_", "canvas.setPointerCapture",
    ):
        assert snippet in cert
    assert "fetch(" not in cert
    assert "firebase.storage" not in cert
    multi=(ROOT/"js/print-specialists/variable-multiup.js").read_text(encoding="utf-8")
    hub=(ROOT/"js/print-specialists/variable-hub.js").read_text(encoding="utf-8")
    for marker in (
        "ui.register('multi-variable'", "mvRoster", "mvPdf", "mvExport",
        "grid(", "plan.items(sheet)", "pdf.embedPage(original.getPage(0),box",
        "page.drawPage(artwork", "page.drawImage(img.image", "cropMarks(page,pos)",
        "DPI=300", "MAX_PEOPLE=300", "가변데이터_다단_", "source=bytes",
    ):
        assert marker in multi
    assert "fetch(" not in multi
    assert "firebase.storage" not in multi
    assert "ui.register('variable-hub'" in hub
    assert "ui.open(select.value)" in hub


def test_certificate_script_parses():
    result=subprocess.run(["node","--check",str(CERT)],cwd=ROOT,capture_output=True,text=True)
    assert result.returncode == 0,result.stdout+result.stderr
