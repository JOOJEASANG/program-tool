"""Regression for restoring existing advanced-PDF sessions with saved overlays."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_saved_overlays_hydrate_before_state_notification():
    s = read("js/pdf-editor-advanced/session-persistence.js")
    marker = s.index("page.overlays = Array.isArray(overlays)")
    emit = s.index("emitStateChange('session-load')")
    assert marker < emit
    assert "__PS_OVERLAYS_V1__=" in s


def test_failed_session_download_does_not_close_modal_or_remove_saved_session():
    s = read("js/pdf-editor-advanced/session-persistence.js")
    assert "showRecovery(data, docId, message)" in s
    assert "modal.hidden = false" in s
    assert "advancedSessionRetry" in s
    assert "advancedSessionChooseLocal" in s
    assert "recoverySession = { data, docId }" in s
    assert "if (!response.ok)" in s
    assert "storage/object-not-found" in s
    assert "저장된 편집정보는 그대로 남아 있습니다." in s
    assert "await blob.slice(0, 1024).text()" in s


def test_manual_recovery_revalidates_originals_and_never_reuses_old_storage():
    s = read("js/pdf-editor-advanced/session-persistence.js")
    app = read("js/pdf-editor-advanced/app.js")
    assert "totalBytes(files) !== Number(data.totalBytes)" in s
    assert "loadedSession = docId && !localFiles ?" in s
    assert "validatePages: sourcePages =>" in s
    assert "if (typeof validatePages === 'function') validatePages(" in app
    assert app.index("if (typeof validatePages === 'function')") < app.index("resetAllState();", app.index("export async function loadPdfFiles("))


def test_deployment_checks_cors_before_hosting():
    script = read(".github/workflows/firebase-deploy.yml")
    assert "backend/venv/bin/python scripts/configure_pdf_storage_cors.py" in script
    assert script.index("configure_pdf_storage_cors.py") < script.index("Firebase 전체 배포")
