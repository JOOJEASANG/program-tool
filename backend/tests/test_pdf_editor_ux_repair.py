from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
REPAIR = ROOT / "js" / "pdf-editor" / "ux-repair.js"
DOCK_ALIGN = ROOT / "js" / "pdf-editor" / "dock-width-align.js"
NUP_HELPER = ROOT / "js" / "pdf-editor" / "nup-helper.js"
UPLOAD = ROOT / "js" / "pdf-editor" / "upload-fix.js"
LIVE = ROOT / "js" / "pdf-editor" / "live-preview.js"
CONTROLLER = ROOT / "js" / "pdf-editor" / "preview-controller.js"
HF_CLEANUP = ROOT / "js" / "pdf-editor" / "hf-input-cleanup.js"


def test_pdf_editor_cleanup_controller_and_dock_load_in_order():
    text = LOADER.read_text(encoding="utf-8")
    assert "/js/pdf-editor/ux-repair.js" in text
    assert "/js/pdf-editor/preview-controller.js" in text
    assert "/js/pdf-editor/dock-width-align.js" in text
    assert text.rfind("/js/pdf-editor/ux-repair.js") > text.rfind("/js/pdf-editor/multifile-interaction-fix.js")
    assert text.rfind("/js/pdf-editor/preview-controller.js") > text.rfind("/js/pdf-editor/booklet-reliability.js")
    assert text.rfind("/js/pdf-editor/dock-width-align.js") > text.rfind("/js/pdf-editor/preview-controller.js")


def test_legacy_file_nup_row_is_removed_from_thumbnail_grid():
    repair = REPAIR.read_text(encoding="utf-8")
    helper = NUP_HELPER.read_text(encoding="utf-8")
    assert ".file-nup-row-v5,#fileNupOverridePanel{display:none!important}" in repair
    assert "cleanupLegacyFileRows" in repair
    assert "makeFileRow" not in helper
    assert "renderFileRowsUnderPageList" not in helper


def test_legacy_floating_dock_code_is_removed_from_repair_module():
    text = REPAIR.read_text(encoding="utf-8")
    assert "pdf-output-floating" not in text
    assert "installFloatingDock" not in text
    assert "화면 고정" not in text
    assert "width:336px" not in text


def test_flat_dock_matches_sidebar_full_width_and_padding():
    text = DOCK_ALIGN.read_text(encoding="utf-8")
    assert "aside.clientWidth" in text
    assert "rect.left" in text
    assert "padding-left" in text
    assert "padding-right" in text
    assert "dock.style.setProperty('right', 'auto', 'important')" in text
    assert "dock.style.setProperty('bottom', '0', 'important')" in text
    assert "ResizeObserver" in text
    assert "setInterval(" not in text


def test_moderate_documents_restore_live_preview_through_controller():
    text = REPAIR.read_text(encoding="utf-8")
    assert "MODERATE_PAGE_LIMIT = 120" in text
    assert "window.__pdfEditorFastMode = false" in text
    assert "window.PdfPreviewController.request" in text
    assert "대용량 최적화" in text


def test_preview_controller_is_single_flight_and_deduplicated():
    text = CONTROLLER.read_text(encoding="utf-8")
    assert "let running = false" in text
    assert "rerunRequested" in text
    assert "lastSignature" in text
    assert "triggerPreview = controlledTrigger" in text
    assert "schedulePreview = controlledSchedule" in text
    assert "stopImmediatePropagation" in text


def test_legacy_runtime_modules_have_no_eval_or_unbounded_polling():
    for path in (UPLOAD, LIVE, REPAIR, CONTROLLER, HF_CLEANUP, NUP_HELPER, DOCK_ALIGN):
        text = path.read_text(encoding="utf-8")
        assert "window.eval(" not in text
        assert "setInterval(" not in text


def test_header_footer_inputs_are_rebound_without_dynamic_assignment():
    text = HF_CLEANUP.read_text(encoding="utf-8")
    assert "cloneNode(true)" in text
    assert "assignValue" in text
    assert "eval(" not in text
