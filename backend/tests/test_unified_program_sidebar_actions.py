from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_shared_sidebar_action_runtime_covers_non_utility_programs_only():
    script = read("js/program-sidebar-actions.js")

    for route in (
        "smart-print-layout",
        "print-checker",
        "pdf-advanced",
        "pdf-editor",
    ):
        assert route in script

    assert "route === 'utility'" in script
    assert "pdf-preflight" in script
    assert "편집저장" in script
    assert "불러오기" in script
    assert "ps-program-actions-grid" in script
    assert "grid-template-columns:34px minmax(0,1fr) minmax(0,1fr) 34px" in script
    assert "programSidebarActionsReady" in script


def test_each_non_utility_runtime_loads_or_already_has_the_sidebar_actions():
    pdf_runtime = read("js/pdf-editor/route-runtime.js")
    print_access = read("js/print-checker/access.js")
    advanced_bootstrap = read("js/pdf-editor-advanced/firebase-bootstrap.js")
    smart_html = read("smart-print-layout/index.html")

    assert "/js/program-sidebar-actions.js?v=20260916-1" in pdf_runtime
    assert "/js/program-sidebar-actions.js?v=20260916-1" in print_access
    assert "/js/program-sidebar-actions.js?v=20260916-1" in advanced_bootstrap

    for marker in (
        'id="smartHomeBtn"',
        'id="smartSessionSaveBtn"',
        'id="smartSessionLoadBtn"',
        'id="logoutBtn"',
    ):
        assert marker in smart_html


def test_print_checker_session_persistence_and_rules_are_owner_scoped():
    session = read("js/print-checker/session-persistence.js")
    firestore_rules = read("firestore.rules")
    storage_rules = read("storage.rules")

    assert "print_checker_sessions" in session
    assert "program-studio-print-checker-session" in session
    assert "print-checker-session-source" in session
    assert "PrintChecker?.selectProduct" in session
    assert "PrintChecker?.inspectFile" in session
    assert "PrintChecker?.setFileSide" in session
    assert "fileHasBleed" in session
    assert "adjX" in session and "adjY" in session and "adjScale" in session

    assert "match /users/{uid}/print_checker_sessions/{docId}" in firestore_rules
    assert "isOwner(uid) && approved(uid)" in firestore_rules
    assert "match /print_checker_sessions/{userId}/{sessionId}/{fileName}" in storage_rules
    assert "validPrintCheckerSessionUpload" in storage_rules
    assert "request.resource.metadata.ownerUid == userId" in storage_rules
    assert "request.resource.metadata.purpose == 'print-checker-session-source'" in storage_rules


def test_pdf_utility_route_does_not_load_unified_sidebar_actions():
    preflight_runtime = read("js/pdf-preflight/route-runtime.js")
    assert "programSidebarActionsScriptV1" not in preflight_runtime
    assert "/js/program-sidebar-actions.js" not in preflight_runtime
