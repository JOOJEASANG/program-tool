from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "pdf-editor" / "save-operation.js"
REGISTER = ROOT / "js" / "sw-register.js"
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"



def test_save_summary_is_loaded_only_for_pdf_editor():
    register = REGISTER.read_text(encoding="utf-8")
    assert "pdfSaveOperationScript" in register
    assert "/js/pdf-editor/save-operation.js?v=20260731-1" in register
    assert register.count("pdfSaveOperationScript") == 1
    assert LOADER.read_text(encoding="utf-8").count("'/js/pdf-editor/") == 8



def test_summary_stage_does_not_wrap_preview_or_api_functions():
    source = MODULE.read_text(encoding="utf-8")
    assert "stage: 'summary-only'" in source
    assert "apiProcessPdf =" not in source
    assert "buildAllPages =" not in source
    assert "displayPreview =" not in source
    assert "window.fetch =" not in source
    assert "AbortController" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source



def test_download_guard_is_bounded_and_requires_explicit_confirmation():
    source = MODULE.read_text(encoding="utf-8")
    assert "button.addEventListener('click'" in source
    assert "event.stopImmediatePropagation()" in source
    assert "bypassNextDownload = true" in source
    assert "button.click()" in source
    assert "attempts < 14" in source
    assert "setTimeout(boot, 170 + attempts * 60)" in source



def test_summary_uses_current_output_settings_and_safe_text_rendering():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "groupByNup",
        "bookletReorderPreview",
        "PdfEditorLayoutExport?.marginValues",
        "PdfPrintMarks?.settings",
        "pnAutoReserve",
        "facingPages",
        "hfEnabled",
        "wmEnabled",
        "replaceChildren",
        "textContent = value",
    ):
        assert marker in source
    assert "원본 그림을 자동 확대하지 않으므로" in source



def test_summary_modal_has_accessible_controls():
    source = MODULE.read_text(encoding="utf-8")
    assert 'role="dialog"' in source
    assert 'aria-modal="true"' in source
    assert "PDF 저장 설정 최종 확인" in source
    assert "확인 후 PDF 생성" in source
    assert "event.key === 'Escape'" in source
