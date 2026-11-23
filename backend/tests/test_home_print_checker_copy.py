from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_home_replaces_design_creation_with_customer_file_bleed_correction():
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    launcher = (ROOT / "js/pdf-suite-home-launcher.js").read_text(encoding="utf-8")
    studio = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    for home in (index, launcher):
        assert "name:'인쇄 디자인 보완'" in home
        assert "name:'AI 디자인 제작'" not in home
        assert "url:'ai-design-maker/'" in home
        assert "도련과 배경을 확장" in home
        assert "인쇄용 PDF" in home
    assert 'id="fileInput"' in studio
    assert 'id="processBtn"' in studio
    assert 'id="saveBtn"' in studio
    assert 'id="beforeCanvas"' in studio
    assert 'id="afterCanvas"' in studio
    assert 'id="generateBtn"' not in studio
    assert "디자인 검토/제작" not in launcher
    assert "pdf-home-unified-design-five-programs-v11" in launcher
