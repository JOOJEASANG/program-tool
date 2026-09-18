from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "perfect-binding-cover" / "index.html"
LOADER = ROOT / "js" / "cover-jspdf-loader.js"
DESIGN_OUTPUT = ROOT / "js" / "design-editor" / "output.js"


def test_retired_cover_editor_redirects_without_old_pdf_runtime():
    html = HTML.read_text(encoding="utf-8")
    assert "location.replace('/print-checker?product=cover')" in html
    assert 'http-equiv="refresh"' in html
    assert not LOADER.exists()
    assert not DESIGN_OUTPUT.exists()
