from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_home_merges_design_creation_and_print_review_into_design_studio():
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    launcher = (ROOT / "js/pdf-suite-home-launcher.js").read_text(encoding="utf-8")
    studio = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")

    for home in (index, launcher):
        assert "name:'표지 디자인'" in home
        assert "name:'인쇄파일 검토'" not in home
        assert "name:'AI 디자인 제작'" not in home
        assert "url:'ai-design-maker/'" in home
        assert "AI 배경·문구·PDF·이미지" in home
        assert "인쇄용 파일로 저장하세요." in home
        assert "표지 디자인" in home

    assert 'id="designLayerUpload"' in studio
    assert 'id="designReviewResults"' in studio
    assert 'id="generateBtn"' in studio
    assert '/print-checker/' in studio  # compatible route for detailed legacy preflight
    assert "디자인 검토/제작" not in launcher
    assert "pdf-home-unified-design-five-programs-v11" in launcher
