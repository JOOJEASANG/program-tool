from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "document-editor" / "index.html"
APP = ROOT / "js" / "document-editor" / "app.js"
STYLE = ROOT / "css" / "document-editor.css"
SMOKE = ROOT / "tests" / "browser" / "document-editor-smoke.html"
RUNNER = ROOT / "scripts" / "run_document_editor_browser_smoke.sh"
QUALITY = ROOT / ".github" / "workflows" / "quality-gate.yml"
HOME = ROOT / "js" / "home-professional-suite.js"


def test_document_editor_stage1_has_a4_workspace_and_real_tools():
    page = PAGE.read_text(encoding="utf-8")
    for marker in (
        "문서 편집기",
        'id="documentPage"',
        'contenteditable="true"',
        'id="blockFormat"',
        'data-command="bold"',
        'data-command="insertUnorderedList"',
        'id="insertTableBtn"',
        'id="imageInput"',
        'id="draftState"',
        'id="printBtn"',
        '/js/document-editor/app.js?v=20260823-1',
    ):
        assert marker in page
    style = STYLE.read_text(encoding="utf-8")
    assert "width:210mm" in style
    assert "min-height:297mm" in style
    assert "@media print" in style


def test_document_editor_stage1_is_local_autosave_and_supports_table_image_print():
    source = APP.read_text(encoding="utf-8")
    for marker in (
        "const DRAFT_KEY='programStudio.documentEditor.stage1'",
        "const MAX_DRAFT_BYTES=4_500_000",
        "function saveDraft()",
        "function restoreDraft()",
        "function insertTable(rows=3,cols=3)",
        "function insertImageDataUrl(dataUrl,alt='삽입 이미지')",
        "async function prepareImage(file)",
        "function printDocument()",
        "root.print()",
        "stage:'document-editor-core-stage1'",
    ):
        assert marker in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source


def test_document_editor_stage1_has_real_browser_smoke():
    smoke = SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    for marker in (
        "api.format('bold')",
        "api.insertTable(2,3)",
        "api.insertImageDataUrl(tinyPng,'테스트 이미지')",
        "api.saveDraft()===true",
        "api.restoreDraft()===true",
        "api.printDocument()===true",
        "api.newDocument(true)===true",
        "pass('edit, format, table, image, autosave restore, print and new document')",
    ):
        assert marker in smoke
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert 'data-document-stage="document-editor-core-stage1"' in runner


def test_document_editor_stage1_home_activation_happens_only_with_real_route():
    source = HOME.read_text(encoding="utf-8")
    block = source[source.index("id:'document-editor'"):source.index("id:'pdf-editor'")]
    assert "document-editor/" in block
    assert "status:'active'" in block
    assert "문서 작성" in block and "표·이미지" in block and "PDF 출력" in block


def test_document_editor_stage1_quality_gate_runs_browser_smoke():
    quality = QUALITY.read_text(encoding="utf-8")
    assert "document-editor-browser-smoke:" in quality
    assert "bash scripts/run_document_editor_browser_smoke.sh" in quality
