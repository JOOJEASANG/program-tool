from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "document-editor" / "index.html"
PRINT_LAYOUT = ROOT / "js" / "document-editor" / "print-layout.js"
WORKFLOW = ROOT / "js" / "document-editor" / "workflow.js"
STYLE = ROOT / "css" / "document-editor-print-layout.css"
SMOKE = ROOT / "tests" / "browser" / "document-editor-print-layout-smoke.html"
RUNNER = ROOT / "scripts" / "run_document_editor_print_layout_smoke.sh"
QUALITY = ROOT / ".github" / "workflows" / "quality-gate.yml"


def test_stage5_exposes_page_break_and_print_header_footer_controls():
    page = PAGE.read_text(encoding="utf-8")
    for marker in (
        'id="insertPageBreakBtn"',
        'id="removePageBreaksBtn"',
        'id="printHeaderText"',
        'id="printFooterText"',
        'id="printHeaderEnabled"',
        'id="printFooterEnabled"',
        'id="printLayoutState"',
        'id="documentPrintHeader"',
        'id="documentPrintFooter"',
        '/css/document-editor-print-layout.css?v=20260824-1',
        '/js/document-editor/print-layout.js?v=20260824-1',
    ):
        assert marker in page
    assert STYLE.exists()


def test_stage5_print_layout_is_local_and_preserves_noneditable_page_breaks():
    source = PRINT_LAYOUT.read_text(encoding="utf-8")
    for marker in (
        "const SETTINGS_KEY='programStudio.documentEditor.printLayout.stage5'",
        "function applySettings(next={},options={})",
        "function refreshPageBreaks()",
        "function insertPageBreak()",
        "function removeAllPageBreaks()",
        "marker.dataset.documentPageBreak='true'",
        "marker.setAttribute('contenteditable','false')",
        "stage:'document-editor-print-layout-stage5'",
    ):
        assert marker in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source


def test_stage5_print_css_has_real_print_page_break_and_running_regions():
    source = STYLE.read_text(encoding="utf-8")
    for marker in (
        'data-document-page-break="true"',
        'break-after:page!important',
        'page-break-after:always!important',
        '.document-print-running[data-active="true"]',
        'position:fixed',
        '#documentPrintHeader{top:7mm',
        '#documentPrintFooter{bottom:7mm',
        '.document-page[data-print-header="true"]',
        '.document-page[data-print-footer="true"]',
    ):
        assert marker in source


def test_stage5_project_roundtrip_preserves_print_layout_and_sanitizes_break_markers():
    source = WORKFLOW.read_text(encoding="utf-8")
    for marker in (
        "'data-document-page-break'",
        "node.hasAttribute('data-document-page-break')",
        "node.getAttribute('data-document-page-break')!=='true'",
        "const printLayout=root.DocumentEditorPrintLayout?.getSettings?.()",
        "project.printLayout=printLayout",
        "root.DocumentEditorPrintLayout?.applySettings?.(payload.printLayout||{}, {save:true})",
        "root.DocumentEditorPrintLayout?.refreshPageBreaks?.()",
    ):
        assert marker in source


def test_stage5_browser_smoke_covers_page_break_print_settings_and_project_roundtrip():
    smoke = SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    quality = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "layout.insertPageBreak()",
        "layout.applySettings({header:'2026 사업보고서'",
        "workflow.buildProject()",
        "workflow.serializeProject()",
        "workflow.restoreProject(project)",
        "workflow.sanitizeDocumentHtml",
        "layout.removeAllPageBreaks()",
        "pass('page breaks, running print header/footer and project roundtrip')",
    ):
        assert marker in smoke
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert 'data-document-print-stage="document-editor-print-layout-stage5"' in runner
    assert "bash scripts/run_document_editor_print_layout_smoke.sh" in quality
