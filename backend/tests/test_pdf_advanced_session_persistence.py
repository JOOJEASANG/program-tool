from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LAYOUT_HTML = ROOT / "pdf-editor" / "index.html"
LAYOUT_SAFETY = ROOT / "js" / "pdf-editor" / "session-save-safety.js"
ADVANCED_HTML = ROOT / "pdf-editor-advanced" / "index.html"
ADVANCED_SESSION = ROOT / "js" / "pdf-editor-advanced" / "session-persistence.js"
FIRESTORE_RULES = ROOT / "firestore.rules"
STORAGE_RULES = ROOT / "storage.rules"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_layout_session_save_uses_owner_metadata_and_loads_source_files_back():
    html = text(LAYOUT_HTML)
    safety = text(LAYOUT_SAFETY)
    storage = text(STORAGE_RULES)

    assert 'id="navSessionBtn"' in html
    assert 'id="navSessionLoadBtn"' in html
    assert "function collectEditorState()" in html
    assert "async function loadEditorSession" in html
    assert ".getDownloadURL()" in html
    assert "const savedPages = state.pages || []" in html

    for marker in (
        "customMetadata",
        "ownerUid: user.uid",
        "purpose: 'pdf-session-source'",
        "sessionId",
        "state: JSON.stringify(state)",
        "MAX_SESSION_BYTES = 300 * 1024 * 1024",
    ):
        assert marker in safety

    assert "validSessionUpload" in storage
    assert "request.resource.metadata.ownerUid == userId" in storage
    assert "request.resource.metadata.purpose == 'pdf-session-source'" in storage


def test_advanced_top_actions_match_layout_structure_and_load_session_module():
    html = text(ADVANCED_HTML)
    home = html.index('id="advancedHomeBtn"')
    save = html.index('id="advancedSessionSaveBtn"')
    load = html.index('id="advancedSessionLoadBtn"')
    logout = html.index('id="logoutBtn"')
    assert home < save < load < logout
    assert ">편집저장</button>" in html
    assert ">편집불러오기</button>" in html
    assert "session-persistence.js?v=20260909-1" in html


def test_advanced_session_snapshot_covers_page_and_document_edit_state():
    source = text(ADVANCED_SESSION)
    for marker in (
        "paper: clone(advancedState.paper)",
        "margins: clone(advancedState.margins)",
        "headerFooter: clone(advancedState.headerFooter)",
        "pageNumbers: clone(advancedState.pageNumbers)",
        "rotation: Number(page.rotation || 0)",
        "fineRotation: Number(page.fineRotation || 0)",
        "crop: clone(page.crop",
        "eraseRegions: clone(page.eraseRegions || [])",
        "scale: Number(page.scale || 1)",
        "offsetX: Number(page.offsetX || 0)",
        "offsetY: Number(page.offsetY || 0)",
    ):
        assert marker in source


def test_advanced_session_save_and_load_are_isolated_and_restore_source_page_mapping():
    source = text(ADVANCED_SESSION)
    rules = text(FIRESTORE_RULES)

    assert "SESSION_COLLECTION = 'pdf_advanced_sessions'" in source
    assert "SESSION_FORMAT = 'program-studio-advanced-pdf-session'" in source
    assert "pdf_sessions/${user.uid}/${sessionId}/src_${index}.pdf" in source
    assert "customMetadata: { ownerUid: user.uid, purpose: 'pdf-session-source', sessionId }" in source
    assert "input.dispatchEvent(new Event('change', { bubbles: true }))" in source
    assert "const loadedMap = new Map(advancedState.pages.map(page => [pageKey(page), page]))" in source
    assert "advancedState.pages = restored" in source
    assert "page.eraseRegions = clone(saved.eraseRegions || [])" in source
    assert "clearHistory()" in source
    assert "emitStateChange('session-load')" in source

    assert "match /users/{uid}/pdf_advanced_sessions/{docId}" in rules
    assert "validPdfSessionMetadata()" in rules
    assert "allow update: if false;" in rules


def test_advanced_session_limits_match_existing_pdf_session_security_contract():
    source = text(ADVANCED_SESSION)
    for marker in (
        "MAX_SESSIONS = 10",
        "MAX_FILES = 50",
        "MAX_FILE_BYTES = 200 * 1024 * 1024",
        "MAX_TOTAL_BYTES = 300 * 1024 * 1024",
        "serialized.length > 850000",
    ):
        assert marker in source
