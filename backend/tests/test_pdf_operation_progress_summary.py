from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
OPERATION = ROOT / "js" / "pdf-editor" / "operation-progress-summary.js"
API = ROOT / "js" / "api.js"


def test_operation_module_loads_after_preview_controller_and_before_dock():
    loader = LOADER.read_text(encoding="utf-8")
    assert "/js/pdf-editor/operation-progress-summary.js" in loader
    assert loader.rfind("operation-progress-summary.js") > loader.rfind("preview-controller.js")
    assert loader.rfind("operation-progress-summary.js") < loader.rfind("dock-width-align.js")


def test_save_is_guarded_by_a_settings_summary():
    text = OPERATION.read_text(encoding="utf-8")
    assert "PDF 저장 설정 확인" in text
    assert "확인 후 PDF 생성" in text
    assert "event.stopImmediatePropagation()" in text
    assert "downloadBypass = true" in text
    assert "outputPages" in text
    assert "원본 벡터·텍스트 품질 유지" in text


def test_progress_panel_supports_cancel_and_abort_controller():
    text = OPERATION.read_text(encoding="utf-8")
    assert "pdfOperationPanel" in text
    assert "pdfOperationFill" in text
    assert "작업 취소" in text
    assert "new AbortController()" in text
    assert "activeOperation.controller.abort()" in text
    assert "error?.name === 'AbortError'" in text


def test_preview_build_reports_progress_and_checks_cancel_between_pages():
    text = OPERATION.read_text(encoding="utf-8")
    assert "buildAllPagesWithProgress" in text
    assert "if (signal?.aborted) throw abortError()" in text
    assert "미리보기 페이지 구성 중" in text
    assert "페이지 번호와 문서 요소 적용 중" in text
    assert "displayPreviewWithOperationFinish" in text


def test_api_process_pdf_accepts_signal_progress_and_shorter_timeout():
    text = API.read_text(encoding="utf-8")
    assert "onProgress, signal" in text
    assert "_uploadStorageFile" in text
    assert "task.cancel()" in text
    assert "signal?.addEventListener('abort'" in text
    assert "setTimeout(() => controller.abort(), 290000)" in text
    assert "310000" not in text
    assert "_reportProgress(onProgress, 'complete', 100" in text


def test_storage_backed_preflight_path_is_never_reused_after_server_request():
    text = API.read_text(encoding="utf-8")
    assert "Storage-backed endpoints delete the object server-side" in text
    assert "__preflightTemp = null" in text


def test_operation_modules_have_no_eval_or_unbounded_polling():
    for path in (OPERATION, API):
        text = path.read_text(encoding="utf-8")
        assert "window.eval(" not in text
        assert "setInterval(" not in text
