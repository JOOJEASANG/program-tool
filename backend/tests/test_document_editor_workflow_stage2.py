from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "document-editor" / "index.html"
WORKFLOW = ROOT / "js" / "document-editor" / "workflow.js"
STYLE = ROOT / "css" / "document-editor-workflow.css"
SMOKE = ROOT / "tests" / "browser" / "document-editor-workflow-smoke.html"
RUNNER = ROOT / "scripts" / "run_document_editor_workflow_smoke.sh"
QUALITY = ROOT / ".github" / "workflows" / "quality-gate.yml"


def test_document_editor_stage2_exposes_page_find_and_project_controls():
    page = PAGE.read_text(encoding="utf-8")
    for marker in (
        'id="pageOrientation"',
        'id="pageMargin"',
        'id="findText"',
        'id="replaceText"',
        'id="findNextBtn"',
        'id="replaceAllBtn"',
        'id="projectExportBtn"',
        'id="projectImportBtn"',
        'id="projectFileInput"',
        '/css/document-editor-workflow.css?v=20260824-1',
        '/js/document-editor/workflow.js?v=20260824-1',
    ):
        assert marker in page
    assert STYLE.exists()


def test_document_editor_stage2_has_local_page_find_and_portable_project_engine():
    source = WORKFLOW.read_text(encoding="utf-8")
    for marker in (
        "const SETTINGS_KEY='programStudio.documentEditor.pageSettings.stage2'",
        "const PROJECT_FORMAT='program-studio-document-project'",
        "const PROJECT_VERSION=2",
        "const MAX_PROJECT_BYTES=5_000_000",
        "function applyPageSettings(next={},options={})",
        "function findText(query)",
        "function replaceAllText(query,replacement='')",
        "function sanitizeDocumentHtml(html)",
        "function buildProject()",
        "function restoreProject(payload)",
        "async function importProjectFile(file)",
        "stage:'document-editor-workflow-stage2'",
    ):
        assert marker in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source
    assert "script,style,iframe,object,embed,link,meta,form,svg,math,video,audio,source,canvas" in source
    assert "javascript:" not in source


def test_document_editor_stage2_browser_smoke_covers_roundtrip_and_sanitization():
    smoke = SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    quality = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "workflow.applyPageSettings({orientation:'landscape',margin:'narrow'})",
        "workflow.findText('천안')",
        "workflow.replaceAllText('천안','지역')",
        "workflow.buildProject()",
        "workflow.serializeProject()",
        "workflow.restoreProject(project)",
        "workflow.sanitizeDocumentHtml",
        "pass('page setup, find replace, portable project roundtrip and sanitization')",
    ):
        assert marker in smoke
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert 'data-document-workflow-stage="document-editor-workflow-stage2"' in runner
    assert "bash scripts/run_document_editor_workflow_smoke.sh" in quality
