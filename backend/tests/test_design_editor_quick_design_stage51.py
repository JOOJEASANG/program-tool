from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
QUICK = ROOT / "js" / "design-editor" / "phase15-quick-design.js"
OUTPUT = ROOT / "js" / "design-editor" / "output.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_quick_design_module_loads_after_print_safety():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorQuickDesignScriptV1" in source
    assert "/js/design-editor/phase15-quick-design.js?v=20260822-1" in source
    assert source.index("designEditorPrintSafetyScriptV1") < source.index("designEditorQuickDesignScriptV1")


def test_quick_design_exposes_simple_title_presets_and_rounded_box_controls():
    source = QUICK.read_text(encoding="utf-8")
    for marker in (
        "빠른 꾸미기",
        "포인트 제목",
        "라벨 제목",
        "밑줄 제목",
        "둥근 박스",
        "큰 제목 꾸미기 · 클릭 한 번",
        "세로 바",
        "짧은 선",
        "하이라이트",
        "도트",
        "cornerRadius",
        "shapeShadow",
        "은은한 그림자",
        "DesignEditorPhase2?.addShape?.('rect')",
        "DesignEditorDraftScope.saveCurrent",
        "stage:'simple-shape-title-style-controls'",
    ):
        assert marker in source


def test_quick_design_is_event_driven_without_runtime_observers():
    source = QUICK.read_text(encoding="utf-8")
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "requestAnimationFrame" in source


def test_print_output_matches_editor_title_and_shape_styles():
    source = OUTPUT.read_text(encoding="utf-8")
    for marker in (
        "roundedRectPath(ctx,x,y,w,h,radius)",
        "drawTitleDecoration(ctx,item,x,y,w,sizePx,blockHeight)",
        "item.titleStyle",
        "item.titleAccent",
        "style==='bar'",
        "style==='pill'",
        "style==='highlight'",
        "style==='underline'",
        "item.cornerRadius",
        "item.shapeShadow",
        "shadowBlur=1.8*PX_PER_MM",
        "stage:'300dpi-print-output'",
    ):
        assert marker in source
