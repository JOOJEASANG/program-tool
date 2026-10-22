"""Protect upload-free re-save and PDF export across the three stateful editors."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def test_smart_layout_and_advanced_reuse_only_identical_original_files():
    for path, loaded, upload, overwrite in (
        ("js/smart-print-layout/session-persistence.js", "loadedSession", "storage.ref(path).put", "smartSessionOverwriteConfirm"),
        ("js/pdf-editor-advanced/session-persistence.js", "loadedSession", "storage.ref(path).put", "advancedSessionOverwriteConfirm"),
    ):
        source = read(path)
        assert loaded in source
        assert overwrite in source
        assert "file === files[index]" in source
        assert "storagePaths.push(target.storagePaths[previous" in source or "storagePaths.push(target.storagePaths[prior" in source
        assert "await db.runTransaction(async transaction" in source
        assert "JSON.stringify(current.storagePaths) !== JSON.stringify(target.storagePaths)" in source
        assert "uploadedPaths.push(path)" in source
        assert upload in source
        assert "await cleanupStoragePaths(uploadedPaths, storage)" in source
        assert "target.storagePaths.filter(path => !storagePaths.includes(path))" in source
        assert "createdAt: firebase.firestore.FieldValue.serverTimestamp()" in source

def test_print_checker_skips_upload_only_if_its_source_is_identical():
    source = read("js/print-checker/session-persistence.js")
    assert "target.file === currentSourceFile" in source
    assert "if (!reused) await storage.ref(storagePath).put" in source
    assert "if (storage && !reused) await cleanupStoragePaths([storagePath], storage)" in source
    assert "await db.runTransaction(async transaction" in source
    assert "loadedSession = {uid:window.auth.currentUser.uid,docId" in source
    assert "/js/print-checker/session-persistence.js?v=20261022-1" in read("print-checker/index.html")

def test_smart_final_export_reuses_inputs_and_authorizes_saved_sources():
    client = read("js/smart-print-layout/app.js")
    server = read("backend/routers/pdf_smart_layout.py")
    assert "const cachedSources = new Map()" in client
    assert "reusableSourcePaths?.(files)" in client
    assert "retain_temp_sources:true" in client
    assert "/api/pdf/smart-layout-storage" in client
    assert "newlyUploaded.map(path => storage.ref(path).delete())" in client
    assert "@pdf_smart_layout_bp.route('/smart-layout-storage', methods=['POST'])" in server
    assert "fa_firestore.client()" in server
    assert ".collection('pdf_smart_layout_sessions')" in server
    assert "p not in recorded" in server
    assert "pdf_sessions/" in server and "pdf_temp/" in server
    assert "if not retain_temp_sources:" in server
    assert "@pdf_smart_layout_bp.route('/smart-layout', methods=['POST'])" in server

def test_advanced_final_export_authorizes_input_reuse():
    client = read("js/pdf-editor-advanced/api.js")
    server = read("backend/routers/pdf_advanced.py")
    session = read("js/pdf-editor-advanced/session-persistence.js")
    assert "const reusableInputs = new Map()" in client
    assert "reusableSourcePaths?.(files)" in client
    assert "source_session_doc: saved?.docId || null" in client
    assert "retain_temp_sources: true" in client
    assert "newlyUploaded.map(path => storage.ref(path).delete())" in client
    assert "reusableSourcePaths(files)" in session
    assert ".collection(\"pdf_advanced_sessions\")" in server
    assert "path not in recorded" in server
    assert "_cleanup_storage(bucket, temporary_paths)" in server
    assert "_cleanup_storage(bucket, storage_paths)" not in server

def test_update_rules_preserve_creation_time_and_require_new_revision():
    rules = read("firestore.rules")
    for collection in ("pdf_advanced_sessions", "pdf_smart_layout_sessions", "print_checker_sessions"):
        section = rules.split(f"match /users/{{uid}}/{collection}/{{docId}} {{", 1)[1].split("allow delete:", 1)[0]
        assert "validPdfSessionMetadata()" in section
        assert "request.resource.data.createdAt == resource.data.createdAt" in section
        assert "request.resource.data.sessionId != resource.data.sessionId" in section
        assert "request.resource.data.updatedAt == request.time" in section

def test_local_programs_avoid_unnecessary_server_uploads():
    design = read("js/ai-design-maker.js")
    merge = read("js/pdf-utility/local-processing.js")
    checker = read("js/print-checker/print-checker.js")
    assert "async function exportPdf(vector=true)" in design
    assert "const url=URL.createObjectURL(pdf)" in design
    assert "mergeLocally(files)" in merge
    assert "서버 업로드 없이 완료했습니다." in merge
    assert "function runCheck()" in checker
