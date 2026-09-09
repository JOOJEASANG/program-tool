from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BOOT_GUARD = ROOT / "js" / "app-boot-guard.js"


def _source() -> str:
    return BOOT_GUARD.read_text(encoding="utf-8")


def test_advanced_pdf_editor_marks_profile_before_runtime_mounts():
    source = _source()
    assert "function isAdvancedPdfEditor()" in source
    assert "root.dataset.pdfEditorProfile='advanced'" in source
    assert "root.dataset.pdfEditorAdvancedRoute='1'" in source


def test_advanced_pdf_editor_does_not_mount_print_workflow_runtime():
    source = _source()
    assert "isPdfPrintEditor()&&!advancedPdfEditor" in source
    assert "root.dataset.pdfPrintWorkflowSuppressed='advanced'" in source


def test_advanced_pdf_editor_hides_legacy_layout_controls_before_first_paint():
    source = _source()
    for selector in (
        "#nupGrid",
        "#bookletRow",
        "#fileLayoutControl",
        "#pdfPrintWorkflowFocusPanel",
        "#pdfPrintUtilityRedirectCard",
    ):
        assert selector in source
