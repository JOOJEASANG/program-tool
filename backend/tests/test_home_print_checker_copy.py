from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_home_print_checker_card_matches_design_review_and_ai_cover_scope():
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    launcher = (ROOT / "js/pdf-suite-home-launcher.js").read_text(encoding="utf-8")

    expected_name = "디자인 검토/제작"
    expected_description = (
        "완성 인쇄물의 재단 규격·도련·안전 영역·책등을 검토하고, "
        "같은 작업 화면에서 AI로 뒤표지·책등·앞표지 전체 펼침 표지를 제작합니다."
    )

    assert expected_name in index
    assert expected_name in launcher
    assert expected_description in launcher
    assert "tags:['인쇄 검토','AI 표지 제작','책등·도련']" in launcher
    assert "인쇄물 사전 검토" not in launcher
    assert "외부에서 제작한 인쇄물 PDF의 재단선·안전 영역·접지선·책등·간격을 검토합니다." not in launcher
    assert "pdf-home-five-programs-v8" in launcher
