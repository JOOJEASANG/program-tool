"""Regression coverage for advanced-PDF storage download delivery."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def test_advanced_pdf_download_runs_with_direct_storage_delivery():
    result = subprocess.run(
        ["node", "--test", str(ROOT / "tests" / "pdf-advanced-download-delivery.test.mjs")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_advanced_pdf_save_action_exposes_manual_retry():
    app = (ROOT / "js" / "pdf-editor-advanced" / "app.js").read_text(encoding="utf-8")
    assert "deliverEditedPdf(result);" in app
    assert "advancedManualDownloadLink" in app
    assert "link.click()" in app
    assert "URL.revokeObjectURL(url)" in app
    assert "5 * 60 * 1000" in app
