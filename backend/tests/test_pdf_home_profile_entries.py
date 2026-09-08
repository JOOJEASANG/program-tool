from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_pdf_home_launcher_exposes_layout_advanced_and_utility_entries():
    source = (ROOT / "js" / "pdf-suite-home-launcher.js").read_text(encoding="utf-8")
    assert "id:'pdf-editor'" in source
    assert "name:'PDF 배치용'" in source
    assert "url:'pdf-editor/'" in source
    assert "id:'pdf-editor-advanced'" in source
    assert "name:'PDF 고급편집용'" in source
    assert "url:'pdf-editor-advanced'" in source
    assert "id:'pdf-suite'" in source
    assert "pdfHomeWorkspace='four-programs'" in source
    assert "stage:'pdf-home-four-programs-v6'" in source
