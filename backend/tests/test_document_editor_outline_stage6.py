from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "document-editor" / "index.html"
OUTLINE = ROOT / "js" / "document-editor" / "outline.js"
STYLE = ROOT / "css" / "document-editor-outline.css"
SMOKE = ROOT / "tests" / "browser" / "document-editor-outline-smoke.html"
RUNNER = ROOT / "scripts" / "run_document_editor_outline_smoke.sh"
QUALITY = ROOT / ".github" / "workflows" / "quality-gate.yml"


def test_stage6_exposes_document_outline_controls_and_assets():
    page = PAGE.read_text(encoding="utf-8")
    for marker in (
        'id="refreshOutlineBtn"',
        'id="documentOutlineList"',
        'id="outlineState"',
        'aria-label="문서 제목 개요"',
        '/css/document-editor-outline.css?v=20260824-1',
        '/js/document-editor/outline.js?v=20260824-1',
    ):
        assert marker in page
    assert STYLE.exists()


def test_stage6_outline_is_local_heading_only_and_auto_refreshes():
    source = OUTLINE.read_text(encoding="utf-8")
    for marker in (
        "querySelectorAll('h1,h2,h3')",
        "function collectHeadings()",
        "function renderOutline()",
        "function focusHeading(index)",
        "new MutationObserver(scheduleRefresh)",
        "observer.observe(node,{subtree:true,childList:true,characterData:true})",
        "node.addEventListener('input',scheduleRefresh)",
        "stage:'document-editor-outline-stage6'",
    ):
        assert marker in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source
    assert "localStorage" not in source


def test_stage6_outline_style_has_level_indentation_active_and_scrollable_list():
    source = STYLE.read_text(encoding="utf-8")
    for marker in (
        '.document-outline-list',
        'max-height:220px',
        '.document-outline-item.level-2',
        '.document-outline-item.level-3',
        '.document-outline-item.active',
        '.document-outline-empty',
    ):
        assert marker in source


def test_stage6_browser_smoke_covers_navigation_refresh_and_clean_document_html():
    smoke = SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    quality = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "outline.renderOutline()",
        "outline.focusHeading(1)",
        "win.getSelection().toString()==='세부 계획'",
        "second.textContent='수정된 세부 계획'",
        "outline.collectHeadings().length===4",
        "!core.getContent().includes('data-outline-')",
        "pass('heading outline navigation, automatic refresh and clean document HTML')",
    ):
        assert marker in smoke
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert 'data-document-outline-stage="document-editor-outline-stage6"' in runner
    assert "bash scripts/run_document_editor_outline_smoke.sh" in quality
