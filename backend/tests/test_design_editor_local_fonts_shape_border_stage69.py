from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BOOT = ROOT / "js" / "app-boot-guard.js"
LOCAL_FONTS = ROOT / "js" / "design-editor" / "local-fonts.js"
SHAPE_BORDER = ROOT / "js" / "design-editor" / "shape-border-controls.js"
RUNNER = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"


def test_stage69_design_runtime_loads_local_fonts_and_shape_border_controls():
    source = BOOT.read_text(encoding="utf-8")
    assert "designLocalFontsScriptV1" in source
    assert "/js/design-editor/local-fonts.js" in source
    assert "designShapeBorderControlsScriptV1" in source
    assert "/js/design-editor/shape-border-controls.js" in source


def test_stage69_local_fonts_are_permission_gated_and_not_uploaded():
    source = LOCAL_FONTS.read_text(encoding="utf-8")
    assert "window.queryLocalFonts" in source
    assert "new FontFace" in source
    assert "record.blob()" in source
    assert "localFontPostscriptName" in source
    assert "missingLocalFonts" in source
    assert "서버나 Firebase로 업로드하지 않습니다" in source
    assert "fetch(" not in source
    assert "firebase.storage" not in source


def test_stage69_local_font_permission_request_is_bound_to_explicit_user_button():
    source = LOCAL_FONTS.read_text(encoding="utf-8")
    assert "id=\"designLocalFontLoad\"" in source
    assert "addEventListener('click',queryFonts)" in source
    assert "async function queryFonts()" in source


def test_stage69_local_font_output_guard_requires_real_fontface_load_in_session():
    source = LOCAL_FONTS.read_text(encoding="utf-8")
    assert "loadedAliases.add(alias)" in source
    assert "loadedAliases.has(alias)" in source
    assert "document.fonts?.check" not in source
    assert "if(!loaded)throw new Error" in source


def test_stage69_local_font_output_guard_blocks_missing_pc_fonts():
    source = LOCAL_FONTS.read_text(encoding="utf-8")
    assert "designPngBtn" in source
    assert "designPdfBtn" in source
    assert "designPressPdfBtn" in source
    assert "event.stopImmediatePropagation()" in source
    assert "출력을 중단했습니다" in source


def test_stage69_shape_border_none_uses_transparent_stroke_for_real_output():
    source = SHAPE_BORDER.read_text(encoding="utf-8")
    assert "TRANSPARENT_STROKE='rgba(0,0,0,0)'" in source
    assert "strokeDisabled" in source
    assert "strokeColorBeforeNone" in source
    assert "item.stroke=TRANSPARENT_STROKE" in source
    assert "inner.style.border='none'" in source
    assert "300DPI PNG/PDF" in source


def test_stage69_shape_border_control_recovers_after_phase2_inspector_rebuild():
    source = SHAPE_BORDER.read_text(encoding="utf-8")
    assert "lastSelectedShapeId" in source
    assert "shapeFromInspector" in source
    assert "data-phase2-layer" in source
    assert "getSelectedShapeId" in source
    assert "MutationObserver(queueSync)" in source
    assert "setInterval" in source


def test_stage69_browser_suite_runs_both_new_smokes():
    source = RUNNER.read_text(encoding="utf-8")
    assert "run_design_editor_local_fonts_smoke.sh" in source
    assert "run_design_editor_shape_border_smoke.sh" in source
