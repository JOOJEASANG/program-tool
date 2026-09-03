from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "document-editor" / "index.html"
USABILITY = ROOT / "js" / "document-editor" / "usability.js"
STYLE = ROOT / "css" / "document-editor-usability.css"
SMOKE = ROOT / "tests" / "browser" / "document-editor-usability-smoke.html"
RUNNER = ROOT / "scripts" / "run_document_editor_usability_smoke.sh"
QUALITY = ROOT / ".github" / "workflows" / "quality-gate.yml"


def test_stage3_exposes_starter_templates_zoom_and_safe_paste_ui():
    page = PAGE.read_text(encoding="utf-8")
    for marker in (
        'id="formTemplateChips"',
        'id="formTemplateList"',
        'id="documentZoom"',
        'id="usabilityState"',
        'data-form-tab="forms"',
        'data-form-insert="approval"',
        'data-form-insert="signature"',
        '/css/document-editor-usability.css?v=20260824-1',
        '/js/document-editor/usability.js?v=20260903-1',
        '/js/document-editor/forms.js?v=20260903-1',
    ):
        assert marker in page
    assert STYLE.exists()


def test_stage3_usability_engine_is_local_and_reuses_stage2_sanitizer():
    source = USABILITY.read_text(encoding="utf-8")
    for marker in (
        "const ZOOM_KEY='programStudio.documentEditor.zoom.stage3'",
        "const ZOOM_LEVELS=[75,90,100,110,125,150]",
        "meeting:{",
        "weekly:{",
        "notice:{",
        "function applyZoom(value,options={})",
        "function applyTemplate(key,options={})",
        "function handlePaste(event)",
        "workflow()?.sanitizeDocumentHtml",
        "page()?.addEventListener('paste',handlePaste)",
        "stage:'document-editor-usability-stage3'",
    ):
        assert marker in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source


def test_stage3_browser_smoke_covers_zoom_template_and_sanitized_rich_paste():
    smoke = SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    quality = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "usability.applyZoom(125)",
        "usability.applyTemplate('meeting',{force:true})",
        "usability.handlePaste",
        "const unsafeScript='<'+'script>window.bad=1<'+'/script>'",
        "pass('zoom, starter template and sanitized rich paste')",
    ):
        assert marker in smoke
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert 'data-document-usability-stage="document-editor-usability-stage3"' in runner
    assert "bash scripts/run_document_editor_usability_smoke.sh" in quality
