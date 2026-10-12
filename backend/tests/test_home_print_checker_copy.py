from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_home_splits_design_review_and_ai_design_maker():
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    launcher = (ROOT / "js/pdf-suite-home-launcher.js").read_text(encoding="utf-8")

    assert "name:'인쇄파일 검토'" in index
    assert "name:'인쇄파일 검토'" in launcher
    assert "name:'AI 디자인 제작'" in index
    assert "name:'AI 디자인 제작'" in launcher
    assert "url:'ai-design-maker/'" in index
    assert "url:'ai-design-maker/'" in launcher
    assert "PDF·이미지의 실제 규격, 도련, 재단선, 안전영역, 책등·접지" in launcher
    assert "AI 배경과 문구를 조합해 저장합니다" in launcher
    assert "tags:['인쇄 전 검사','규격','도련','재단선','안전영역']" in launcher
    assert "tags:['책 표지 제작','AI 배경','책등','300dpi']" in launcher
    assert "디자인 검토/제작" not in launcher
    assert "pdf-home-six-programs-v10" in launcher
