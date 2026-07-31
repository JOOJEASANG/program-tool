from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "pdf-editor" / "save-operation.js"
API = ROOT / "js" / "api.js"


def test_progress_manager_uses_existing_api_callbacks():
    source = MODULE.read_text(encoding="utf-8")
    api = API.read_text(encoding="utf-8")
    assert "window.PdfOperationManager =" in source
    assert "function apiOptions()" in source
    assert "onProgress: updateProgress" in source
    assert "onStatus: (message) => updateProgress({ message })" in source
    assert "_preparePdfOptions" in api
    assert "PdfOperationManager?.apiOptions?.()" in api
    assert "_finishManagedPdfOperation" in api


def test_progress_panel_covers_api_stages_and_accessibility():
    source = MODULE.read_text(encoding="utf-8")
    assert "pdfSaveProgressPanelV2" in source
    assert "panel.setAttribute('role', 'status')" in source
    assert "panel.setAttribute('aria-live', 'polite')" in source
    assert "PDF 생성 중" in source
    assert "PDF 생성 완료" in source
    assert "PDF 생성 실패" in source


def test_progress_is_monotonic_and_has_bounded_completion_monitor():
    source = MODULE.read_text(encoding="utf-8")
    assert "Math.max(activeOperation.percent" in source
    assert "attempt >= 620" in source
    assert "setTimeout(() => monitorDownloadButton(sequence, attempt + 1), 500)" in source
    assert "setInterval(" not in source


def test_progress_stage_does_not_replace_core_functions():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "apiProcessPdf =",
        "buildAllPages =",
        "displayPreview =",
        "window.fetch =",
        "applyDocEdits =",
    ):
        assert marker not in source
