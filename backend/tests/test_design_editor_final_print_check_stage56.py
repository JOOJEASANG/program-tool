from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FINAL_CHECK = ROOT / "js" / "design-editor" / "phase22-final-print-check.js"
OUTPUT = ROOT / "js" / "design-editor" / "output.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_final_print_check_is_loaded_after_existing_print_safety():
    register = REGISTER.read_text(encoding="utf-8")
    assert "designEditorFinalPrintCheckScriptV1" in register
    assert "/js/design-editor/phase22-final-print-check.js?v=20260822-1" in register
    assert register.index("designEditorPrintSafetyScriptV1") < register.index("designEditorFinalPrintCheckScriptV1")


def test_final_print_check_scans_all_surfaces_and_core_print_risks():
    source = FINAL_CHECK.read_text(encoding="utf-8")
    for marker in (
        "const MIN_TEXT_PT=8",
        "const RECOMMENDED_BLEED_MM=3",
        "const MIN_SAFE_MM=3",
        "const FOLD_BUFFER_MM=2.5",
        "for(const surface of p.surfaces||[])",
        "kind:'bleed'",
        "kind:'safe-setting'",
        "'small-text'",
        "'fold'",
        "'image-fold'",
        "effectiveDpi(item,dimensions)",
        "dpi<200",
        "dpi<250",
    ):
        assert marker in source


def test_missing_or_unreadable_images_are_fatal_and_cannot_be_bypassed():
    source = FINAL_CHECK.read_text(encoding="utf-8")
    assert "issue('fatal',surface,item,'missing-image'" in source
    assert "issue('fatal',surface,item,'unreadable-image'" in source
    assert "const allowContinue=Boolean(options.allowContinue)&&summary.fatalCount===0" in source
    assert "if(summary.fatalCount){await showSummary(summary,{allowContinue:false,format:options.format});return false;}" in source


def test_warnings_can_be_reviewed_before_output_and_clean_jobs_pass_immediately():
    source = FINAL_CHECK.read_text(encoding="utf-8")
    assert "if(!summary.warningCount)" in source
    assert "return showSummary(summary,{allowContinue:true,format:options.format});" in source
    assert "경고 확인 후 출력 계속" in source
    assert "인쇄 적합" in source


def test_png_and_pdf_output_use_final_gate_on_general_editor_route():
    source = OUTPUT.read_text(encoding="utf-8")
    assert "path!=='/design-editor/general'" in source
    assert "path!=='/design-editor/general.html'" in source
    assert "path!=='/design-editor/index.html'" not in source
    assert source.count("DesignEditorFinalPrintCheck?.confirmBeforeOutput") == 2
    assert "await gate({format:'png'})" in source
    assert "await gate({format:'pdf'})" in source


def test_final_print_check_is_bounded_and_event_driven():
    source = FINAL_CHECK.read_text(encoding="utf-8")
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "[180,420,800,1300,2200,3200]" in source
    assert "stage:'all-surfaces-final-print-gate'" in source
