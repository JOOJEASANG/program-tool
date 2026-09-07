from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTE = ROOT / "js" / "pdf-preflight" / "route-runtime.js"
LABELS = ROOT / "js" / "pdf-preflight" / "menu-labels.js"


def test_pdf_utility_plain_language_menu_is_loaded_last():
    route = ROUTE.read_text(encoding="utf-8")
    marker = "{id:'pdfUtilityPlainMenuLabelsScriptV1',src:'/js/pdf-preflight/menu-labels.js?v=20260907-1'}"
    assert marker in route
    assert route.index("pdfPreflightPanelBalanceScriptV1") < route.index("pdfUtilityPlainMenuLabelsScriptV1")


def test_pdf_utility_menu_names_are_plain_and_larger():
    source = LABELS.read_text(encoding="utf-8")
    for label in (
        "PDF 한꺼번에 검사",
        "PDF 여러 개 합치기",
        "PDF 배경 지우기",
        "PDF 용량 줄이기",
        "PDF 오류 복구",
        "PDF 비밀번호 걸기",
        "PDF 비밀번호 풀기",
        "필요한 페이지만 저장",
        "빈 페이지 지우기",
        "페이지 삭제·순서 바꾸기",
        "페이지 보며 정리하기",
        "PDF·이미지 서로 바꾸기",
        "큰 문서 나눠 인쇄하기",
    ):
        assert label in source
    assert "font-size:13px!important" in source
    assert "PDF 작업 메뉴" in source
    assert "여러 PDF 한꺼번에 작업" in source
    assert "선택한 PDF 한 개 작업" in source
    assert "data-pdf-plain-menu-label" in source
