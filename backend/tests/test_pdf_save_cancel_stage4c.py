from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "pdf-editor" / "save-operation.js"
API = ROOT / "js" / "api.js"
REGISTER = ROOT / "js" / "sw-register.js"
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"


def test_cancel_stage_is_loaded_with_bounded_runtime_structure():
    register = REGISTER.read_text(encoding="utf-8")
    source = MODULE.read_text(encoding="utf-8")
    assert "/js/pdf-editor/save-operation.js?v=20260731-3" in register
    assert register.count("pdfSaveOperationScript") == 1
    assert LOADER.read_text(encoding="utf-8").count("'/js/pdf-editor/") == 8
    assert "stage: 'summary-progress-cancel'" in source
    assert "stage: 'progress-cancel'" in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_cancel_button_aborts_only_the_active_save_controller():
    source = MODULE.read_text(encoding="utf-8")
    assert "pdfSaveProgressCancelV3" in source
    assert ">작업 취소</button>" in source
    assert "function requestCancel()" in source
    assert "activeOperation.cancelRequested = true" in source
    assert "activeOperation.controller.abort()" in source
    assert "controller: new AbortController()" in source
    assert "signal: activeOperation.controller.signal" in source
    assert "취소 요청을 처리하고 있습니다..." in source


def test_api_forwards_abort_and_cleans_temporary_uploads():
    api = API.read_text(encoding="utf-8")
    assert "signal: managed.signal" in api
    assert "signal?.addEventListener('abort', forwardAbort" in api
    assert "task.cancel()" in api
    assert "await Promise.allSettled(storagePaths.map(path => st.ref(path).delete()))" in api
    assert "signal?.removeEventListener('abort', forwardAbort)" in api
    assert "_finishManagedPdfOperation(__managedOperation, 'canceled'" in api


def test_cancel_result_restores_user_facing_state_without_core_wrappers():
    source = MODULE.read_text(encoding="utf-8")
    assert "PDF 생성이 취소되었습니다." in source
    assert "const canceled = result === 'canceled' || activeOperation.cancelRequested" in source
    assert "if (cancelButton) cancelButton.disabled = true" in source
    assert "activeOperation = null" in source
    assert "showCanceledStatus" in source
    for marker in (
        "apiProcessPdf =",
        "buildAllPages =",
        "displayPreview =",
        "window.fetch =",
        "applyDocEdits =",
    ):
        assert marker not in source


def test_cancel_monitor_waits_for_native_download_button_recovery():
    source = MODULE.read_text(encoding="utf-8")
    assert "button && !button.disabled" in source
    assert "activeOperation.cancelRequested" in source
    assert "attempt >= 620" in source
    assert "setTimeout(() => monitorDownloadButton(sequence, attempt + 1), 500)" in source
