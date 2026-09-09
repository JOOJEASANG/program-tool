from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BOOT_GUARD = ROOT / "js" / "app-boot-guard.js"
RUNTIME_BOOT = ROOT / "js" / "sw-register.js"
ADVANCED_HTML = ROOT / "pdf-editor-advanced" / "index.html"


def _boot_source() -> str:
    return BOOT_GUARD.read_text(encoding="utf-8")


def test_standalone_advanced_pdf_editor_gets_its_own_route_marker():
    source = _boot_source()
    assert "function isStandaloneAdvancedPdfEditor()" in source
    assert "path.endsWith('/pdf-editor-advanced')" in source
    assert "root.dataset.pdfAdvancedStandaloneRoute='1'" in source
    assert "root.dataset.pdfPrintWorkflowSuppressed='standalone-advanced'" in source


def test_standalone_advanced_pdf_editor_is_not_a_general_print_editor():
    source = _boot_source()
    definition = source.split("function isPdfPrintEditor(){", 1)[1].split("function isLegacyAdvancedPdfProfile", 1)[0]
    assert "'/pdf-editor-advanced'" not in definition
    assert "'/pdf-editor'" in definition
    assert "isPdfPrintEditor()&&!legacyAdvancedProfile" in source


def test_standalone_advanced_pdf_editor_does_not_need_legacy_hide_css():
    html = ADVANCED_HTML.read_text(encoding="utf-8")
    assert 'data-pdf-advanced-standalone="1"' in html
    for legacy in ("nupGrid", "bookletRow", "fileLayoutControl", "pdfSpreadSplitPanel"):
        assert legacy not in html


def test_shared_runtime_boot_never_mounts_general_pdf_runtime_on_standalone_advanced():
    source = RUNTIME_BOOT.read_text(encoding="utf-8")
    protected = source.split("function isProtectedRuntimePage(){", 1)[1].split("const reveal=", 1)[0]
    helpers = source.split("async function helpers(){", 1)[1].split("async function boot(){", 1)[0]
    assert "'/pdf-editor-advanced'" in protected
    assert "'/pdf-editor-advanced'" not in helpers
    assert "loadPdfEditorRuntime()" in helpers
