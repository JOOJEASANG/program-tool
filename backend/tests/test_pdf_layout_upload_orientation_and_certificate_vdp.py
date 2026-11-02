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
    assert 'certificate-variable.js?v=20261102-1' in smart
    assert 'variable-data.js?v=20261028-1' in smart
    for snippet in (
        "ui.register('certificates'", "cvPdf", "cvRoster", "cvColumn",
        "cvPerson", "cvRun", "cvMode", "cvPreview", "cvCancel",
        "상장·수료증 가변데이터 출력", "sourceDoc", "pdfjsLib.getDocument",
        "window.XLSX.read", "sheet_to_json", "localStorage.setItem",
        "ctx.library('pdf')", "output.embedPdf(pdfBytes,[0])",
        "output.embedPng", "dpi=300", "MAX_PEOPLE=300",
        "상장_가변데이터_", "canvas.setPointerCapture",
    ):
        assert snippet in cert
    assert "fetch(" not in cert
    assert "firebase.storage" not in cert


def test_certificate_script_parses():
    result=subprocess.run(["node","--check",str(CERT)],cwd=ROOT,capture_output=True,text=True)
    assert result.returncode == 0,result.stdout+result.stderr
