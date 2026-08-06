import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "perfect-binding-cover" / "index.html"
OUTPUT_SAFETY = ROOT / "js" / "cover-output-performance-safety.js"
LOADER = ROOT / "js" / "cover-jspdf-loader.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_jspdf_loader_behavior.cjs"


def test_cover_source_no_longer_loads_retired_compatibility_scripts():
    source = HTML.read_text(encoding="utf-8")
    assert "../js/cover-editor-multiselect.js" not in source
    assert "../js/cover-editor-layer-style.js" not in source
    assert "../js/cover-editor-image-tools.js" in source


def test_cover_source_lazy_loads_jspdf_only_at_output_boundary():
    html = HTML.read_text(encoding="utf-8")
    safety = OUTPUT_SAFETY.read_text(encoding="utf-8")
    loader = LOADER.read_text(encoding="utf-8")
    assert "jspdf.umd.min.js" not in html
    assert html.count('../js/cover-jspdf-loader.js') == 1
    assert html.index('../js/cover-jspdf-loader.js') < html.index('async function createOutput')
    assert "if(kind!=='png')await window.CoverJsPdfLoader.ensure()" in html
    assert "function ensure()" in loader
    assert "document.head.appendChild(script)" in loader
    assert "function ensureJsPdf()" in safety
    assert "recoverJsPdf(event, button)" in safety
    assert "output.kind !== 'png' && !jsPdfReady()" in safety


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


def test_cover_source_has_no_sample_title_or_year_values():
    source = HTML.read_text(encoding="utf-8")
    assert "2026학년도 방과후학교 운영 계획서" not in source
    assert '<textarea id="frontTitle" placeholder="표지 제목을 입력하세요"></textarea>' in source
    assert '<input id="publishYear" type="text" placeholder="예: 2026">' in source
    assert '<input id="spineTitle" type="text" placeholder="책등 제목을 입력하세요">' in source
