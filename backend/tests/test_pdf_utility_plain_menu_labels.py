from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTE = ROOT / "js" / "pdf-preflight" / "route-runtime.js"


def test_pdf_utility_plain_language_menu_keeps_runtime_budget_and_final_owner():
    route = ROUTE.read_text(encoding="utf-8")
    final_marker = "{id:'pdfPreflightPanelBalanceScriptV1',src:'/js/pdf-preflight-panel-balance.js?v=20260831-2'}"
    assert "pdfUtilityPlainMenuLabelsScriptV1" not in route
    assert "/js/pdf-preflight/menu-labels.js" not in route
    assert final_marker in route
    assert route.rfind("{id:") == route.index(final_marker)
    assert "startMenuLabels();" in route


def test_pdf_utility_menu_names_are_short_clear_and_larger():
    source = ROUTE.read_text(encoding="utf-8")
    for label in (
        "PDF 검사",
        "PDF 합치기",
        "배경,여백지우기",
        "용량 줄이기",
        "PDF 복구",
        "암호 설정",
        "암호 해제",
        "페이지 골라 저장",
        "빈 페이지 삭제",
        "페이지 삭제·정렬",
        "페이지 보기·정리",
        "PDF·이미지 변환",
        "대형 분할 인쇄",
    ):
        assert label in source
    assert "font-size:13px!important" in source
    assert "PDF 작업 메뉴" in source
    assert "여러 PDF 작업" in source
    assert "선택 PDF 작업" in source
    assert "data-pdf-plain-menu-label" in source
    assert "MutationObserver" in source
