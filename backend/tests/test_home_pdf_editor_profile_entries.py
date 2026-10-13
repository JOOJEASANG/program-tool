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
    assert "id=\"cnt-all\">5<" in home
    assert "id=\"cnt-edit\">3<" in home
    assert 'id="count" role="status" aria-live="polite">5개<' in home
    assert "purpose-grouped-program-home-v6" in home


def test_home_keeps_advanced_editor_purpose_distinct_from_layout_editor():
    home = HOME.read_text(encoding="utf-8")

    assert "N-up·소책자·간지·여백" in home
    assert "이동·크기조절·잘라내기·회전" in home
    assert "tags:['페이지 정리','N-up','소책자','실제 출력크기']" in home
    assert "tags:['페이지 직접 편집','자르기','크기·위치','정밀 회전']" in home


def test_home_exposes_smart_print_layout_under_document_editing():
    home = HOME.read_text(encoding="utf-8")

    assert "id:'smart-print-layout'" in home
    assert "name:'스마트 인쇄배치'" in home
    assert "url:'smart-print-layout/'" in home
    assert "tags:['한 장에 여러 개','자동배치','앞면·뒷면','종이 절약']" in home
    assert "id:'smart-print-layout',cat:'edit'" in home
    assert "catLabel:'문서 편집 · 스마트 인쇄배치'" in home
    assert 'data-cat="print"' not in home
    assert "id=\"cnt-edit\">3<" in home
