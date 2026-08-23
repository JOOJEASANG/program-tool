from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "document-editor" / "index.html"
TABLE_TOOLS = ROOT / "js" / "document-editor" / "table-tools.js"
WORKFLOW = ROOT / "js" / "document-editor" / "workflow.js"
STYLE = ROOT / "css" / "document-editor-table-tools.css"
SMOKE = ROOT / "tests" / "browser" / "document-editor-table-tools-smoke.html"
RUNNER = ROOT / "scripts" / "run_document_editor_table_tools_smoke.sh"
QUALITY = ROOT / ".github" / "workflows" / "quality-gate.yml"


def test_stage4_exposes_table_and_link_editing_controls():
    page = PAGE.read_text(encoding="utf-8")
    for marker in (
        'id="tableAddRowBtn"',
        'id="tableDeleteRowBtn"',
        'id="tableAddColBtn"',
        'id="tableDeleteColBtn"',
        'id="tableDeleteBtn"',
        'id="linkUrl"',
        'id="applyLinkBtn"',
        'id="unlinkBtn"',
        'id="tableToolsState"',
        '/css/document-editor-table-tools.css?v=20260824-1',
        '/js/document-editor/table-tools.js?v=20260824-1',
    ):
        assert marker in page
    assert STYLE.exists()


def test_stage4_table_tools_are_local_and_guard_merged_tables():
    source = TABLE_TOOLS.read_text(encoding="utf-8")
    for marker in (
        "function tableHasSpans(table)",
        "function selectCell(cell)",
        "function addRowAfter()",
        "function deleteRow()",
        "function addColumnAfter()",
        "function deleteColumn()",
        "function deleteTable()",
        "function normalizeLink(value)",
        "function applyLink(value)",
        "function unlink()",
        "noopener noreferrer",
        "병합된 셀이 있는 표는 행·열 구조 변경을 지원하지 않습니다.",
        "stage:'document-editor-table-tools-stage4'",
    ):
        assert marker in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source


def test_stage4_project_sanitizer_preserves_only_safe_links():
    source = WORKFLOW.read_text(encoding="utf-8")
    assert "'A'" in source
    assert "'href','target','rel'" in source
    assert "if(node.tagName==='A')" in source
    assert "https?:\\/\\/|mailto:" in source
    assert "node.setAttribute('rel','noopener noreferrer')" in source


def test_stage4_browser_smoke_covers_table_mutation_link_safety_and_removal():
    smoke = SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    quality = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "tools.addRowAfter()",
        "tools.addColumnAfter()",
        "tools.deleteColumn()",
        "tools.deleteRow()",
        "tools.applyLink('example.com')",
        "workflow.buildProject()",
        "workflow.sanitizeDocumentHtml",
        "tools.unlink()",
        "tools.deleteTable()",
        "pass('table row/column editing, safe links and table removal')",
    ):
        assert marker in smoke
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert 'data-document-table-stage="document-editor-table-tools-stage4"' in runner
    assert "bash scripts/run_document_editor_table_tools_smoke.sh" in quality
