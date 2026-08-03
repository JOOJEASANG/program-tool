from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "pdf-editor" / "save-recovery.js"
REGISTER = ROOT / "js" / "sw-register.js"
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"


def test_failure_recovery_loads_once_after_save_operation():
    register = REGISTER.read_text(encoding="utf-8")
    save = "/js/pdf-editor/save-operation.js?v=20260731-3"
    recovery = "/js/pdf-editor/save-recovery.js?v=20260803-1"
    assert register.count("pdfSaveRecoveryScript") == 1
    assert register.count(recovery) == 1
    assert register.index(save) < register.index(recovery)
    assert LOADER.read_text(encoding="utf-8").count("'/js/pdf-editor/") == 8


def test_checkpoint_captures_pages_files_settings_and_controls():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "parsedPages.map(capturePage)",
        "uploadedFiles: [...uploadedFiles]",
        "previewCanvases",
        "collectEditorState()",
        "readGlobalState()",
        "captureControlStates()",
        "snapshot.dividerContent",
        "fileNupMap",
    ):
        assert marker in source


def test_editor_is_locked_during_save_without_blocking_cancel():
    source = MODULE.read_text(encoding="utf-8")
    assert "function lockEditor(checkpoint)" in source
    assert "pdf-save-editor-locked-v1" in source
    assert "element.id === 'pdfSaveProgressCancelV3'" in source
    assert "document.body.setAttribute('aria-busy', 'true')" in source
    assert "document.addEventListener('drop', blockMutationWhileSaving, true)" in source
    assert "key === 'z' || key === 'y'" in source


def test_failure_restores_checkpoint_and_refreshes_editor():
    source = MODULE.read_text(encoding="utf-8")
    assert "const failed = result === 'error'" in source
    assert "restorePages(checkpoint)" in source
    assert "assignGlobalState(checkpoint.globalState)" in source
    assert "PdfEditorLayoutExport?.applyStateMargins" in source
    assert "renderThumbs()" in source
    assert "PdfLivePreview?.request" in source
    assert "편집 상태를 저장 시작 전 상태로 복구했습니다." in source
    assert "result === 'success' || result === 'canceled'" in source


def test_recovery_uses_public_operation_contract_only():
    source = MODULE.read_text(encoding="utf-8")
    assert "manager.apiOptions = function recoveryAwareApiOptions" in source
    assert "manager.finishOperation = function recoveryAwareFinish" in source
    for forbidden in (
        "apiProcessPdf =",
        "window.fetch =",
        "buildAllPages =",
        "displayPreview =",
        "applyDocEdits =",
        "setInterval(",
        "eval(",
    ):
        assert forbidden not in source


def test_completion_monitor_is_bounded_and_manual_recovery_remains_available():
    source = MODULE.read_text(encoding="utf-8")
    assert "MAX_MONITOR_ATTEMPTS = 640" in source
    assert "setTimeout(() => monitorFinalState(sequence, attempt + 1), 500)" in source
    assert "manager?.cancel?.()" in source
    assert "restoreLast: () => restoreCheckpoint(lastCheckpoint, true)" in source
    assert "stage: 'failure-checkpoint-lock-restore'" in source
