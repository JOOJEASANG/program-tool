import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "perfect-binding-cover" / "index.html"
DESIGN_OUTPUT = ROOT / "js" / "design-editor" / "output.js"
LOADER = ROOT / "js" / "cover-jspdf-loader.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_jspdf_loader_behavior.cjs"


def test_retired_cover_source_loads_no_legacy_editor_scripts():
    source = HTML.read_text(encoding="utf-8")
    assert "/design-editor/?mode=cover" in source
    assert "../js/cover-jspdf-loader.js" not in source
    assert "../js/cover-editor-" not in source
    assert "../js/cover-runtime-" not in source
    assert "<canvas" not in source


def test_integrated_design_output_lazy_loads_shared_jspdf_only_at_output_boundary():
    html = HTML.read_text(encoding="utf-8")
    output = DESIGN_OUTPUT.read_text(encoding="utf-8")
    loader = LOADER.read_text(encoding="utf-8")
    assert "jspdf.umd.min.js" not in html
    assert "cover-jspdf-loader.js" not in html
    assert "function ensurePdfLoader()" in output
    assert "script.src='/js/cover-jspdf-loader.js?v=20260806-1'" in output
    assert "document.head.appendChild(script)" in output
    assert "async function exportPdf()" in output
    assert "await loader.ensure()" in output
    assert "function ensure()" in loader
    assert "document.head.appendChild(script)" in loader


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


def test_retired_cover_source_has_no_legacy_form_or_sample_values():
    source = HTML.read_text(encoding="utf-8")
    assert "2026학년도 방과후학교 운영 계획서" not in source
    assert 'id="frontTitle"' not in source
    assert 'id="publishYear"' not in source
    assert 'id="spineTitle"' not in source
    assert '<canvas' not in source
    assert "통합 디자인 편집기의 표지디자인으로 이전되었습니다." in source
