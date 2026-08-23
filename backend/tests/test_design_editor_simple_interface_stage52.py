from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SIMPLE = ROOT / "js" / "design-editor" / "phase16-simple-interface.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_simple_interface_loads_after_quick_design():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorSimpleInterfaceScriptV1" in source
    assert "/js/design-editor/phase16-simple-interface.js?v=20260823-3" in source
    assert source.index("designEditorQuickDesignScriptV1") < source.index("designEditorSimpleInterfaceScriptV1")


def test_simple_interface_runs_on_general_and_embedded_unified_editor_routes():
    source = SIMPLE.read_text(encoding="utf-8")
    assert "const generalPath=path==='/design-editor/general'||path==='/design-editor/general.html'||path.endsWith('/design-editor/general.html')" in source
    assert "const embedded=new URLSearchParams(location.search).get('embed')==='1'" in source
    assert "const embeddedGeneralPath=embedded&&(path==='/design-editor/index.html'||path.endsWith('/design-editor/index.html'))" in source
    assert "if(!generalPath&&!embeddedGeneralPath)return" in source


def test_simple_interface_keeps_basic_tools_visible_and_groups_precision_tools():
    source = SIMPLE.read_text(encoding="utf-8")
    for marker in (
        "designAdvancedTools",
        "designInspectorAdvanced",
        "고급 도구",
        "정밀정렬 · 복사 · 프로젝트 · 회전",
        "세부 설정",
        "기본 설정만 먼저 보여줍니다.",
        "designPhase3LayoutTools",
        "designElementClipboardTools",
        "designProjectFileTools",
        "designRotationTools",
        "designQuickDesignTools",
        "designPhase2Tools",
        "designPhase4SmartLayout",
        "designOutputTools",
        "designPrintQualityTools",
        "designPrintSafetyTools",
        "stage:'basic-first-contextual-sidebar'",
    ):
        assert marker in source


def test_contextual_inspector_keeps_visual_controls_outside_advanced_group():
    source = SIMPLE.read_text(encoding="utf-8")
    assert "kind==='text'" in source
    assert "kind==='image'" in source
    assert "kind==='shape'" in source
    assert "앞 아이콘" in source
    assert "가로 초점" in source
    assert "세로 초점" in source
    assert "아이콘·잠금·세부 간격" in source
    assert "위치·크기·초점·잠금" in source
    assert "위치·크기·잠금" in source
    advanced_line = next(line for line in source.splitlines() if "const ADVANCED_CARD_IDS=" in line)
    assert "designOutputTools" not in advanced_line
    assert "designPrintQualityTools" not in advanced_line
    assert "designPrintSafetyTools" not in advanced_line
    assert "designQuickDesignTools" not in advanced_line


def test_simple_interface_coalesces_event_bursts_without_runtime_polling():
    source = SIMPLE.read_text(encoding="utf-8")
    assert "let syncFrame=0" in source
    assert "if(syncFrame)return" in source
    assert "syncFrame=requestAnimationFrame" in source
    assert "syncFrame=0;" in source
    assert "sync();" in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
