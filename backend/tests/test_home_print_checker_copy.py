from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_home_splits_design_review_and_ai_design_maker():
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    launcher = (ROOT / "js/pdf-suite-home-launcher.js").read_text(encoding="utf-8")

    assert "name:'디자인 검토'" in index
    assert "name:'디자인 검토'" in launcher
    assert "name:'AI 디자인 제작'" in index
    assert "name:'AI 디자인 제작'" in launcher
    assert "url:'ai-design-maker/'" in index
    assert "url:'ai-design-maker/'" in launcher
    assert "완성 인쇄물의 재단 규격·도련·안전 영역·책등·접지" in launcher
    assert "AI 배경과 정확한 한글 문구 레이어" in launcher
    assert "tags:['인쇄 검토','도련·안전영역','책등·접지']" in launcher
    assert "tags:['AI 표지','전체 펼침','책등·도련','300dpi']" in launcher
    assert "디자인 검토/제작" not in launcher
    assert "pdf-home-six-programs-v9" in launcher
