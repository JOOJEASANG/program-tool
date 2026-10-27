from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / "js" / "program-studio-ui-v2.js"
MANUAL_CATALOG = ROOT / "js" / "program-manuals" / "catalog.js"


def test_simple_program_routes_without_usage_help():
    text = UI.read_text(encoding="utf-8")
    for route in (
        "print-checker",
        "smart-print-layout",
        "pdf-editor",
        "pdf-editor-advanced",
        "pdf-preflight",
    ):
        assert f"'{route}'" in text
    assert "30초 사용법" not in text
    assert "psSimpleHelpTrigger" not in text
    assert "SIMPLE_HELP" not in text
    assert "mountSimpleHelpTrigger" not in text
    assert "simple-program-ux-v2" in text


def test_difficult_terms_get_plain_korean_labels():
    text = UI.read_text(encoding="utf-8")
    expected_pairs = {
        "N-up 배치": "한 장에 여러 페이지",
        "기본 N-up (페이지당 슬라이드 수)": "용지 한 면에 넣을 페이지 수",
        "파일에 도련(bleed) 포함": "파일 가장자리에 잘림 여분(도련)이 있음",
        "재단크기 입력/비교": "완성 크기",
        "양면 강제": "항상 양면",
        "문서 검수": "인쇄 전 확인",
        "해상도·폰트·색상·페이지 상태를 확인합니다.": "흐린 이미지, 글꼴, 색상, 페이지 문제를 확인합니다.",
        "페이지 보정 초기화": "이 페이지 원래대로",
    }
    for original, replacement in expected_pairs.items():
        assert original in text
        assert replacement in text


def test_usage_help_is_removed_but_runtime_observers_remain():
    text = UI.read_text(encoding="utf-8")
    assert "openSimpleHelp" not in text
    assert "closeSimpleHelp" not in text
    assert "characterData:true" in text
    assert "requestAnimationFrame(flush)" in text


def test_manual_catalog_does_not_advertise_removed_in_app_help():
    text = MANUAL_CATALOG.read_text(encoding="utf-8")
    assert "SIMPLE_HELP_NOTICE" in text
    assert "사용법” 버튼" not in text
    assert "30초 안내" not in text
    assert "쉬운 표현" in text
