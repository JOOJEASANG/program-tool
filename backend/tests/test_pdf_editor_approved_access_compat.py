from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_firebase_config_does_not_patch_firestore_instances_or_prototypes():
    source = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")

    assert "__programStudioLegacyPdfEditorBridge" not in source
    assert "db.collection = function(collectionName)" not in source
    assert "DocumentSnapshot?.prototype" not in source
    assert "DocumentReference?.prototype" not in source


def test_protected_pages_share_one_program_access_promise():
    source = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")

    assert "window.ProgramAccessReady = Promise.resolve(null)" in source
    assert "const accessPromise = ProgramAccess.guardTool({ programId, timeoutMs: 8000 })" in source
    assert "window.ProgramAccessReady = accessPromise" in source
    assert "accessPromise.finally" in source


def test_advanced_pdf_route_maps_to_pdf_editor_access_before_boot_guard_timeout():
    source = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")

    assert "'/pdf-editor-advanced'" in source
    mapping_start = source.index("programForPath(pathname)")
    mapping_end = source.index("async guardTool", mapping_start)
    mapping_source = source[mapping_start:mapping_end]
    assert "'/pdf-editor-advanced'" in mapping_source
    assert "return 'pdf-editor'" in mapping_source

    bootstrap_start = source.index("window.ProgramAccessReady = Promise.resolve(null)")
    bootstrap_source = source[bootstrap_start:]
    assert "const programId = ProgramAccess.programForPath(location.pathname)" in bootstrap_source
    assert "if (!auth || !programId) return" in bootstrap_source
    assert "window.ProgramAccessReady = accessPromise" in bootstrap_source


def test_pdf_editor_uses_shared_access_result_without_direct_firestore_reads():
    source = (ROOT / "pdf-editor" / "index.html").read_text(encoding="utf-8")
    auth_start = source.index("async function initializePdfEditorAccess()")
    auth_end = source.index("const $ = id =>", auth_start)
    auth_source = source[auth_start:auth_end]

    assert "await window.ProgramAccessReady" in auth_source
    assert "const user = auth.currentUser" in auth_source
    assert "db.collection(" not in auth_source
    assert "user_permissions" not in auth_source
    assert "settings').doc('admin')" not in auth_source
    assert "permDoc.data().programs" not in source


def test_approved_account_policy_is_defined_only_by_program_access():
    source = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")

    assert "const assigned = access.status === 'approved'" in source
    assert "allowed: access.approved" in source
    assert "public: false" in source
    assert "allowed: access.admin || publicAccess || assigned" not in source
    assert "'pdf-editor': true" not in source
    assert "preflight: true" not in source
    assert "'design-studio': true" not in source