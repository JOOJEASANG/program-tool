from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BOOT = ROOT / "js" / "app-boot-guard.js"
HOME = ROOT / "js" / "pdf-suite-home-launcher.js"
PRINT_CHECKER = ROOT / "print-checker" / "index.html"
SMART_LAYOUT = ROOT / "smart-print-layout" / "index.html"
PRINT_ACCESS = ROOT / "js" / "print-checker" / "access.js"
FIREBASE = ROOT / "js" / "firebase-config.js"
PHASE7 = ROOT / "scripts" / "run_phase7_browser_smoke.sh"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_home_catalog_is_hidden_until_current_five_program_manifest_is_ready():
    boot = read(BOOT)
    home = read(HOME)

    for marker in (
        "program-home-booting",
        "programStudioHomeCatalogFirstPaintStyle",
        "#quickSection",
        "#programGrid",
        "data-pdf-home-unified",
        "root.dataset.pdfHomeUnified==='ready'",
        "releaseHomeCatalog('fallback')",
    ):
        assert marker in boot

    for marker in (
        "id:'print-checker'",
        "id:'smart-print-layout'",
        "id:'pdf-editor'",
        "id:'pdf-editor-advanced'",
        "id:'pdf-suite'",
        "name:'PDF 유틸리티'",
        "url:'pdf-suite/'",
        "document.documentElement.dataset.pdfHomeUnified='ready'",
    ):
        assert marker in home


def test_pdf_layout_waits_for_current_print_workflow_before_reveal():
    boot = read(BOOT)

    for marker in (
        "waitForPdfEditorFunctionalReady",
        "PdfPrintWorkflowFocus",
        "pdfPrintWorkflowFocusPanel",
        "pdf-print-workflow-focus-v1",
        "pdfEditorFunctionalReady",
        "pdfEditorRevealStage",
        "print-workflow-ready",
        "functional=await waitForPdfEditorFunctionalReady()",
    ):
        assert marker in boot


def test_print_checker_and_smart_layout_are_approval_gated_before_reveal():
    print_html = read(PRINT_CHECKER)
    smart_html = read(SMART_LAYOUT)
    print_access = read(PRINT_ACCESS)
    firebase = read(FIREBASE)
    boot = read(BOOT)

    assert 'data-program-studio-print-checker="1" style="visibility:hidden"' in print_html
    assert 'data-smart-print-layout="1" style="visibility:hidden"' in smart_html
    assert "ProgramAccessReady" in print_access
    assert "mode:'approved-only'" in print_access
    for route in ("/print-checker", "/smart-print-layout"):
        assert route in firebase
        assert route in boot
    assert "root.dataset.accessReady = 'true'" in firebase
    assert "if(!access){retryApprovalWait();return;}" in boot


def test_cross_program_first_paint_browser_smokes_are_in_phase7_gate():
    phase7 = read(PHASE7)
    assert 'home-catalog-first-paint-smoke.html' in phase7
    assert 'pdf-layout-functional-first-paint-smoke.html' in phase7
