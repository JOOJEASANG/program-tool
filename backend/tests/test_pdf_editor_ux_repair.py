from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
REPAIR = ROOT / "js" / "pdf-editor" / "ux-repair.js"
DOCK_ALIGN = ROOT / "js" / "pdf-editor" / "dock-width-align.js"
NUP_HELPER = ROOT / "js" / "pdf-editor" / "nup-helper.js"


def test_pdf_editor_ux_repair_and_dock_alignment_load_in_order():
    text = LOADER.read_text(encoding="utf-8")
    assert "/js/pdf-editor/ux-repair.js" in text
    assert "/js/pdf-editor/dock-width-align.js" in text
    assert text.rfind("/js/pdf-editor/ux-repair.js") > text.rfind("/js/pdf-editor/multifile-interaction-fix.js")
    assert text.rfind("/js/pdf-editor/dock-width-align.js") > text.rfind("/js/pdf-editor/ux-repair.js")


def test_legacy_file_nup_row_is_removed_from_thumbnail_grid():
    repair = REPAIR.read_text(encoding="utf-8")
    helper = NUP_HELPER.read_text(encoding="utf-8")
    assert ".file-nup-row-v5,#fileNupOverridePanel{display:none!important}" in repair
    assert "cleanupLegacyFileRows" in repair
    assert "makeFileRow" not in helper
    assert "renderFileRowsUnderPageList" not in helper


def test_output_controls_use_floating_dock():
    text = REPAIR.read_text(encoding="utf-8")
    assert "pdf-output-floating" in text
    assert "bottom:12px!important" in text
    assert "border-radius:16px!important" in text
    assert "화면 고정" in text


def test_floating_dock_matches_sidebar_content_width():
    text = DOCK_ALIGN.read_text(encoding="utf-8")
    assert "aside.clientWidth - paddingLeft - paddingRight" in text
    assert "rect.left + paddingLeft" in text
    assert "dock.style.setProperty('right', 'auto', 'important')" in text
    assert "ResizeObserver" in text
    assert "setInterval(" not in text


def test_moderate_documents_restore_live_preview():
    text = REPAIR.read_text(encoding="utf-8")
    assert "MODERATE_PAGE_LIMIT = 120" in text
    assert "window.__pdfEditorFastMode = false" in text
    assert "await triggerPreview()" in text
    assert "대용량 최적화" in text


def test_repair_modules_have_no_unbounded_polling():
    assert "setInterval(" not in REPAIR.read_text(encoding="utf-8")
    assert "setInterval(" not in NUP_HELPER.read_text(encoding="utf-8")
    assert "setInterval(" not in DOCK_ALIGN.read_text(encoding="utf-8")
