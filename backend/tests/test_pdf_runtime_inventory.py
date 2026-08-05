from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
REGISTER = ROOT / "js" / "sw-register.js"
PDF_MODULES = ROOT / "js" / "pdf-editor"

ACTIVE_MODULES = [
    "font-render-fix.js",
    "upload-fix.js",
    "live-preview.js",
    "layout-export.js",
    "page-count-hint.js",
    "nup-helper.js",
    "preview-row-default.js",
    "divider-helper.js",
]

DEFERRED_MODULES = [
    "page-number-auto-reserve.js",
    "page-number-auto-reserve-layout-v2.js",
    "page-number-preview-parity.js",
    "operation-progress-summary.js",
]


def test_pdf_editor_runtime_keeps_the_approved_eight_modules():
    source = LOADER.read_text(encoding="utf-8")
    positions = []
    for module in ACTIVE_MODULES:
        needle = f"/js/pdf-editor/{module}"
        assert source.count(needle) == 1
        positions.append(source.index(needle))
    assert positions == sorted(positions)
    assert source.count("'/js/pdf-editor/") == 8


def test_deferred_feature_wrappers_are_not_loaded_directly():
    loader = LOADER.read_text(encoding="utf-8")
    register = REGISTER.read_text(encoding="utf-8")
    runtime = loader + "\n" + register
    for module in DEFERRED_MODULES:
        assert f"/js/pdf-editor/{module}" not in runtime
        assert (PDF_MODULES / module).exists()


def test_pdf_editor_route_extras_are_bounded_and_single_loaded():
    source = REGISTER.read_text(encoding="utf-8")
    assert source.count("pdfCropMarksScript") == 1
    assert source.count("/js/pdf-editor/crop-marks.js") == 1
    assert source.count("pdfSaveOperationScript") == 1
    assert source.count("/js/pdf-editor/save-operation.js") == 1
    assert source.count("pdfSaveRecoveryScript") == 1
    assert source.count("/js/pdf-editor/save-recovery.js") == 1
    assert source.count("pdfSessionSaveSafetyScript") == 1
    assert source.count("/js/pdf-editor/session-save-safety.js") == 1
    assert source.count("pdfFileContextScopeScript") == 1
    assert source.count("/js/pdf-editor/file-context-scope.js") == 1
    assert source.index("/js/pdf-editor/save-operation.js") < source.index("/js/pdf-editor/save-recovery.js")
    assert source.index("/js/pdf-editor/save-recovery.js") < source.index("/js/pdf-editor/session-save-safety.js")
    assert source.index("/js/pdf-editor/session-save-safety.js") < source.index("/js/pdf-editor/file-context-scope.js")


def test_integrated_runtime_features_remain_present():
    page_tools = (PDF_MODULES / "page-count-hint.js").read_text(encoding="utf-8")
    nup = (PDF_MODULES / "nup-helper.js").read_text(encoding="utf-8")
    layout = (PDF_MODULES / "layout-export.js").read_text(encoding="utf-8")
    divider = (PDF_MODULES / "divider-helper.js").read_text(encoding="utf-8")
    crop = (PDF_MODULES / "crop-marks.js").read_text(encoding="utf-8")
    save = (PDF_MODULES / "save-operation.js").read_text(encoding="utf-8")
    recovery = (PDF_MODULES / "save-recovery.js").read_text(encoding="utf-8")
    session = (PDF_MODULES / "session-save-safety.js").read_text(encoding="utf-8")
    file_context = (PDF_MODULES / "file-context-scope.js").read_text(encoding="utf-8")

    for marker in ("duplicateSelected", "moveSelected", "deleteSelected", "async function undo", "async function redo"):
        assert marker in page_tools
    for marker in ("소책자 양면 인쇄 안내", "pdf-output-source-label", "N-up 안내"):
        assert marker in nup
    for marker in (
        "individualPaperMarginsV2", "margin_left_mm", "margin_right_mm",
        "margin_top_mm", "margin_bottom_mm", "pageNumberAutoReserveEnabled",
        "requiredPageNumberSpaceMm",
    ):
        assert marker in layout

    assert "PdfDividerHelper" in divider
    assert "extraTexts" in divider
    assert "bleed_mm: numberValue('printBleedMm', 3, 0, 15)" in crop
    assert "원본 그림이나 배경을 자동으로 늘리지 않습니다." in crop
    assert "PDF 문서 편집기" in crop
    assert "PDF 저장 설정 최종 확인" in save
    assert "stage: 'summary-progress-cancel'" in save
    assert "stage: 'progress-cancel'" in save
    assert "activeOperation.controller.abort()" in save
    assert "stage: 'failure-checkpoint-lock-restore'" in recovery
    assert "편집 상태를 저장 시작 전 상태로 복구했습니다." in recovery
    assert "stage: 'multi-source-snapshot-failure-cleanup'" in session
    assert "업로드된 임시 파일 정리를 시도했습니다." in session
    assert "stage: 'discontinuous-file-context-actions'" in file_context
    assert "이 파일 전체 시계방향 90° 회전" in file_context
