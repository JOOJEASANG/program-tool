from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HOME = ROOT / "index.html"


def test_home_exposes_layout_and_advanced_pdf_editors_separately():
    home = HOME.read_text(encoding="utf-8")

    assert "name:'PDF배치'" in home
    assert "url:'pdf-editor/'" in home
    assert "name:'PDF편집'" in home
    assert "url:'pdf-editor-advanced'" in home
    assert "id:'pdf-editor-advanced'" in home
    assert "name:'PDF 배치용'" not in home
    assert "name:'PDF 고급편집용'" not in home
    assert "id=\"cnt-all\">4<" in home
    assert "id=\"cnt-pdf\">3<" in home
    assert "id=\"count\">4개<" in home
    assert "categorized-program-home-v4" in home


def test_home_keeps_advanced_editor_purpose_distinct_from_layout_editor():
    home = HOME.read_text(encoding="utf-8")

    assert "N-up·소책자·간지·여백" in home
    assert "이동·크기조절·잘라내기·회전" in home
    assert "tags:['N-up','소책자','인쇄 배치']" in home
    assert "tags:['드래그 자르기','크기·위치','정밀 회전']" in home
