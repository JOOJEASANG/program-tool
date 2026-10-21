"""PDF saved edit overwrite is an in-place document revision, not an unsafe object replace."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js/pdf-editor/session-save-safety.js"
EDITOR = ROOT / "pdf-editor/index.html"
RULES = ROOT / "firestore.rules"
BEHAVIOR = ROOT / "backend/tests/test_pdf_session_overwrite_behavior.cjs"

def test_overwrite_and_save_as_controls_with_load_binding():
    source = MODULE.read_text(encoding="utf-8")
    editor = EDITOR.read_text(encoding="utf-8")
    for name in ("sessionOverwriteConfirm", "sessionOverwriteDescription", "새 이름으로 저장", "기존 저장본 덮어쓰기"):
        assert name in source or name in editor
    for marker in (
        "setLoadedSession?.({", "docId, sessionId: d.sessionId",
        "clearLoadedSession?.()", "prepareSaveDialog?.()",
    ):
        assert marker in editor

def test_transactional_overwrite_keeps_created_at_and_old_sources_until_commit():
    src = MODULE.read_text(encoding="utf-8")
    for marker in (
        "await db.runTransaction(async (transaction)",
        "transaction.update(targetRef",
        "current.sessionId !== target.sessionId",
        "JSON.stringify(current.storagePaths) !== JSON.stringify(target.storagePaths)",
        "if (!documentRef) await cleanupUploadedPaths(uploadedPaths)",
        "const results = await cleanupUploadedPaths(obsoletePaths)",
        "await trimOldSessions(collection, documentRef.id)",
        "createdAt: firebase.firestore.FieldValue.serverTimestamp()",
    ):
        assert marker in src
    assert src.index("transaction.update(targetRef") < src.index("await cleanupUploadedPaths(obsoletePaths)")

def test_rules_limit_update_to_revision_change_without_changing_creation_timestamp():
    rules = RULES.read_text(encoding="utf-8")
    policy = rules.split("match /users/{uid}/pdf_sessions/{docId} {", 1)[1].split("match /users/{uid}/pdf_advanced_sessions", 1)[0]
    for marker in (
        "validPdfSessionMetadata()",
        "request.resource.data.createdAt == resource.data.createdAt",
        "request.resource.data.sessionId != resource.data.sessionId",
        "request.resource.data.updatedAt == request.time",
    ):
        assert marker in policy

def test_overwrite_behavior_with_immutable_storage_and_concurrency():
    result = subprocess.run(["node", str(BEHAVIOR)], cwd=ROOT, capture_output=True, text=True, timeout=30, check=False)
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf session safe overwrite, cancel, rollback, conflict and save-as-new passed" in result.stdout
