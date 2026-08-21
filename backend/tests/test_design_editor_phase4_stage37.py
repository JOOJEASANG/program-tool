from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PHASE4 = ROOT / "js" / "design-editor" / "phase4-smart-layout.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_phase4_loads_after_layout_controls_only_in_general_design_engine():
    source = REGISTER.read_text(encoding="utf-8")
    assert "if(isPath('/design-editor/general.html'))" in source
    assert "designEditorPhase4SmartLayoutScriptV1" in source
    assert "/js/design-editor/phase4-smart-layout.js?v=20260821-1" in source
    assert source.index("designEditorPhase3ControlsScriptV1") < source.index("designEditorPhase4SmartLayoutScriptV1")


def test_phase4_supports_mode_specific_professional_default_layouts():
    source = PHASE4.read_text(encoding="utf-8")
    for marker in (
        "전문 기본 배치",
        "현재 면 기본 배치 적용",
        "addPosterLayout",
        "addFlyerLayout",
        "addLeafletLayout",
        "addCustomLayout",
        "preset.startsWith('poster-')",
        "preset.startsWith('flyer-')",
        "preset.startsWith('leaflet-')",
        "리플렛 제목",
        "주최 · 주관 기관명",
        "smartLayout:SMART_TAG",
    ):
        assert marker in source


def test_phase4_leaflet_layout_uses_real_fold_boundaries_and_panel_labels():
    source = PHASE4.read_text(encoding="utf-8")
    for marker in (
        "panelBounds",
        "current.folds",
        "current.panels",
        "const start=bounds[index],end=bounds[index+1],panelW=end-start",
        "/앞표지/",
        "/뒷/",
    ):
        assert marker in source


def test_phase4_print_safety_checks_margins_small_text_and_fold_overlap():
    source = PHASE4.read_text(encoding="utf-8")
    for marker in (
        "인쇄 안전 확인",
        "안전여백 밖 글씨",
        "8pt 미만 글씨",
        "접지선과 겹치는 글씨",
        "안전여백 밖 이미지",
        "approxTextHeight",
        "current.folds",
        "현재 면 인쇄 안전 검사를 통과했습니다.",
    ):
        assert marker in source


def test_phase4_only_removes_its_own_generated_elements_and_reuses_autosave():
    source = PHASE4.read_text(encoding="utf-8")
    for marker in (
        "const SMART_TAG='phase4-v1'",
        "item.smartLayout!==SMART_TAG",
        "programTool.designEditor.draft.v1",
        "window.DesignEditorApp?.resumeDraft?.()",
        "window.DesignEditorPhase2?.sync?.()",
        "stage:'print-aware-smart-layout-and-safety'",
    ):
        assert marker in source


def test_phase4_avoids_runtime_watchers_polling_and_eval():
    source = PHASE4.read_text(encoding="utf-8")
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
