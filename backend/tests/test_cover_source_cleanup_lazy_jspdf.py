from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "perfect-binding-cover" / "index.html"
OUTPUT_SAFETY = ROOT / "js" / "cover-output-performance-safety.js"


def test_cover_source_no_longer_loads_retired_compatibility_scripts():
    source = HTML.read_text(encoding="utf-8")
    assert "../js/cover-editor-multiselect.js" not in source
    assert "../js/cover-editor-layer-style.js" not in source
    assert "../js/cover-editor-image-tools.js" in source


def test_cover_source_lazy_loads_jspdf_only_at_output_boundary():
    html = HTML.read_text(encoding="utf-8")
    safety = OUTPUT_SAFETY.read_text(encoding="utf-8")
    assert "jspdf.umd.min.js" not in html
    assert "function ensureJsPdf()" in safety
    assert "document.createElement('script')" in safety
    assert "recoverJsPdf(event, button)" in safety
    assert "output.kind !== 'png' && !jsPdfReady()" in safety


def test_cover_source_has_no_sample_title_or_year_values():
    source = HTML.read_text(encoding="utf-8")
    assert "2026학년도 방과후학교 운영 계획서" not in source
    assert '<textarea id="frontTitle" placeholder="표지 제목을 입력하세요"></textarea>' in source
    assert '<input id="publishYear" type="text" placeholder="예: 2026">' in source
    assert '<input id="spineTitle" type="text" placeholder="책등 제목을 입력하세요">' in source
