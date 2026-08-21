from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SAFETY = ROOT / "js" / "design-editor" / "phase14-print-safety.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_print_safety_module_loads_after_image_quality_stage():
    register = REGISTER.read_text(encoding="utf-8")
    assert "designEditorPrintSafetyScriptV1" in register
    assert "/js/design-editor/phase14-print-safety.js?v=20260822-1" in register
    assert register.index("designEditorPrintQualityScriptV1") < register.index("designEditorPrintSafetyScriptV1")


def test_print_safety_checks_text_margins_minimum_size_and_folds():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "const MIN_TEXT_PT=8",
        "const FOLD_BUFFER_MM=2.5",
        "approxTextHeight",
        "글씨가 안전여백 밖에 있습니다.",
        "글씨가 ${MIN_TEXT_PT}pt보다 작습니다.",
        "글씨가 접지선 가까이에 있습니다.",
        "folds.some(fold=>crossesFold(rect,fold))",
    ):
        assert marker in source


def test_print_safety_checks_images_without_forcing_background_reflow():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "item?.type==='image'",
        "이미지가 안전여백 밖에 있습니다.",
        "이미지가 접지선 가까이에 있습니다.",
        "배경용 이미지는 안전여백 경고를 무시해도 됩니다.",
        "fixable:false",
    ):
        assert marker in source


def test_print_safety_offers_bounded_autofix_for_text_only():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "안전여백·작은 글씨 자동 정리",
        "if((Number(item.size)||0)<MIN_TEXT_PT){item.size=MIN_TEXT_PT",
        "item.w=Math.min(Math.max(4,Number(item.w)||4),maxW)",
        "const nextX=clamp",
        "const nextY=clamp",
        "programTool.designEditor.draft.v1",
        "window.DesignEditorApp?.resumeDraft?.()",
        "window.DesignEditorPhase2?.sync?.()",
        "stage:'automatic-print-safety-and-lightweight-autofix'",
    ):
        assert marker in source


def test_print_safety_is_event_driven_and_clicks_issues_to_select_objects():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "focusIssue(issue)",
        '.design-object[data-id="${issue.id}"]',
        '.phase2-extra-object[data-extra-id="${issue.id}"]',
        "['click','change','pointerup']",
    ):
        assert marker in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "[180,420,800,1300,2200,3200]" in source
