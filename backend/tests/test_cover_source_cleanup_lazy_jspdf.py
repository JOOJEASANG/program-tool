import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "perfect-binding-cover" / "index.html"
DESIGN_OUTPUT = ROOT / "js" / "design-editor" / "output.js"
LOADER = ROOT / "js" / "cover-jspdf-loader.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_jspdf_loader_behavior.cjs"


def test_cover_jspdf_loader_does_not_request_network_until_pdf_output():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-jspdf-loader behavior passed" in result.stdout


