from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
REPAIR = ROOT / "js" / "pdf-editor" / "ux-repair.js"


def test_pdf_editor_ux_repair_is_loaded_last():
    text = LOADER.read_text(encoding="utf-8")
    assert "/js/pdf-editor/ux-repair.js" in text
    assert text.rfind("/js/pdf-editor/ux-repair.js") > text.rfind("/js/pdf-editor/multifile-interaction-fix.js")


def test_legacy_file_nup_row_is_removed_from_thumbnail_grid():
    text = REPAIR.read_text(encoding="utf-8")
    assert ".file-nup-row-v5,#fileNupOverridePanel{display:none!important}" in text
    assert "cleanupLegacyFileRows" in text


def test_output_controls_use_floating_dock():
    text = REPAIR.read_text(encoding="utf-8")
    assert "pdf-output-floating" in text
    assert "left:12px!important" in text
    assert "bottom:12px!important" in text
    assert "border-radius:16px!important" in text
    assert "화면 고정" in text


def test_moderate_documents_restore_live_preview():
    text = REPAIR.read_text(encoding="utf-8")
    assert "MODERATE_PAGE_LIMIT = 120" in text
    assert "window.__pdfEditorFastMode = false" in text
    assert "await triggerPreview()" in text
    assert "대용량 최적화" in text


def test_repair_module_has_no_unbounded_polling():
    text = REPAIR.read_text(encoding="utf-8")
    assert "setInterval(" not in text
