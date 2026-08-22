from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BLOCKS = ROOT / "js" / "design-editor" / "phase17-component-blocks.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_component_blocks_load_after_simple_interface():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorComponentBlocksScriptV1" in source
    assert "/js/design-editor/phase17-component-blocks.js?v=20260822-2" in source
    assert source.index("designEditorSimpleInterfaceScriptV1") < source.index("designEditorComponentBlocksScriptV1")


def test_component_blocks_offer_common_print_content_with_one_click():
    source = BLOCKS.read_text(encoding="utf-8")
    for marker in (
        "빠른 구성",
        "제목 세트",
        "일정·장소·대상",
        "문의·연락처",
        "하단 기관정보",
        "최근 구성요소 제거",
        "행사 제목을 입력하세요",
        "핵심 내용을 한 줄로 정리하세요",
        "2026. 00. 00.  00:00",
        "장소를 입력하세요",
        "참여 대상을 입력하세요",
        "041-000-0000 · 담당부서",
        "주최 · 주관 기관명을 입력하세요",
        "icon:'calendar'",
        "icon:'pin'",
        "icon:'people'",
        "icon:'phone'",
        "titleStyle:'bar'",
        "titleStyle:'line'",
        "componentBlock:TAG",
        "componentGroup:group",
        "stage:'one-click-print-component-blocks'",
    ):
        assert marker in source


def test_component_blocks_respect_leaflet_panel_geometry_and_scoped_autosave():
    source = BLOCKS.read_text(encoding="utf-8")
    assert "current.folds" in source
    assert "current.panels" in source
    assert "/앞표지/.test" in source
    assert "bounds=[0,...folds" in source
    assert "DesignEditorDraftScope?.saveCurrent?.('component-block')" in source
    assert "DesignEditorApp?.resumeDraft?.()" in source
    assert "DesignEditorQuickDesign?.sync?.()" in source
    assert "DesignEditorSimpleInterface?.sync?.()" in source


def test_component_blocks_avoid_polling_observers_and_code_evaluation():
    source = BLOCKS.read_text(encoding="utf-8")
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
