from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "document-editor" / "index.html"
COMMENTS = ROOT / "js" / "document-editor" / "comments.js"
WORKFLOW = ROOT / "js" / "document-editor" / "workflow.js"
STYLE = ROOT / "css" / "document-editor-comments.css"
SMOKE = ROOT / "tests" / "browser" / "document-editor-comments-smoke.html"
RUNNER = ROOT / "scripts" / "run_document_editor_comments_smoke.sh"
QUALITY = ROOT / ".github" / "workflows" / "quality-gate.yml"


def test_stage7_exposes_comment_controls_and_assets():
    page = PAGE.read_text(encoding="utf-8")
    for marker in (
        'id="commentText"',
        'id="addCommentBtn"',
        'id="clearCommentsBtn"',
        'id="documentCommentList"',
        'id="commentState"',
        '/css/document-editor-comments.css?v=20260824-1',
        '/js/document-editor/comments.js?v=20260824-1',
        '/js/document-editor/workflow.js?v=20260824-4',
    ):
        assert marker in page
    assert COMMENTS.exists()
    assert STYLE.exists()


def test_stage7_comment_engine_is_local_bounded_and_dom_clean():
    source = COMMENTS.read_text(encoding="utf-8")
    for marker in (
        "const STORAGE_KEY='programStudio.documentEditor.comments.stage7'",
        "const MAX_COMMENTS=200",
        "const MAX_TEXT=600",
        "function captureAnchor()",
        "function pathFor(element)",
        "function resolveAnchor(comment)",
        "function navigateToComment(id)",
        "function addComment(value)",
        "function deleteComment(id)",
        "function importComments(value,options={})",
        "stage:'document-editor-comments-stage7'",
    ):
        assert marker in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source
    assert "setAttribute('data-comment" not in source
    assert ".dataset.documentComment" not in source


def test_stage7_project_roundtrip_keeps_comments_as_metadata():
    source = WORKFLOW.read_text(encoding="utf-8")
    for marker in (
        "const projectComments=root.DocumentEditorComments?.getComments?.()",
        "project.comments=projectComments",
        "root.DocumentEditorComments?.importComments?.(payload.comments||[],{save:true})",
        "comments:root.DocumentEditorComments?.getComments?.()||[]",
    ):
        assert marker in source
    assert "PROJECT_VERSION=2" in source


def test_stage7_browser_smoke_covers_anchor_fallback_roundtrip_and_cleanup():
    smoke = SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    quality = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "comments.addComment('표현 확인 필요')",
        "workflow.buildProject()",
        "comments.navigateToComment(created.id)",
        "workflow.restoreProject(project)",
        "comments.deleteComment(restoredId)",
        "core.newDocument(true)",
        "pass('paragraph comments, clean project metadata, fallback navigation and restore')",
    ):
        assert marker in smoke
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert 'data-document-comments-stage="document-editor-comments-stage7"' in runner
    assert "bash scripts/run_document_editor_comments_smoke.sh" in quality
