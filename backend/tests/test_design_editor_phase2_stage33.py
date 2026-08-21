from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PHASE2 = ROOT / "js" / "design-editor" / "phase2.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_design_editor_phase2_is_loaded_only_for_design_editor():
    register = REGISTER.read_text(encoding="utf-8")
    assert "if(isPath('/design-editor','/design-editor/index.html'))" in register
    assert "designEditorPhase2ScriptV1" in register
    assert "/js/design-editor/phase2.js?v=20260821-1" in register


def test_design_editor_phase2_adds_images_shapes_and_separate_extra_state():
    source = PHASE2.read_text(encoding="utf-8")
    for marker in (
        "이미지·도형 추가",
        "phase2AddImage",
        "phase2AddRect",
        "phase2AddEllipse",
        "phase2AddLine",
        "current.extras=[]",
        "type:'image'",
        "type:'shape'",
        "shape:kind",
        "이미지 교체",
        "fit:'cover'",
        "focusX:50",
        "focusY:50",
    ):
        assert marker in source
    assert "s.elements.push" not in source


def test_design_editor_phase2_keeps_print_layout_helpers_and_text_spacing():
    source = PHASE2.read_text(encoding="utf-8")
    for marker in (
        "const threshold=2.5",
        "p.safe",
        "s?.folds",
        "phase2-snap-guide",
        "글자 간격·줄 간격",
        "letterSpacing",
        "lineHeight",
        "programTool.designEditor.draft.v1",
        "stage:'images-shapes-snapping-text-spacing'",
    ):
        assert marker in source


def test_design_editor_phase2_clears_text_selection_without_losing_extra_selection():
    source = PHASE2.read_text(encoding="utf-8")
    assert "let suppressBoardClear=false" in source
    assert "suppressBoardClear=true" in source
    assert "finally{suppressBoardClear=false;}" in source
    assert "event.target===byId('artboard')&&!suppressBoardClear" in source
    assert "selectedExtraId=item.id;clearBaseSelection();persist();sync()" in source
    assert "clearBaseSelection();persist();sync();setStatus('이미지를 작업영역에 추가했습니다.'" in source


def test_design_editor_phase2_avoids_reentrant_runtime_watchers():
    source = PHASE2.read_text(encoding="utf-8")
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
