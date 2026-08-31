from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REGISTER = ROOT / "js" / "sw-register.js"
EDITOR = ROOT / "pdf-editor" / "index.html"


def test_runtime_inventory_keeps_single_primary_editor_entrypoint():
    register = REGISTER.read_text(encoding="utf-8")
    editor = EDITOR.read_text(encoding="utf-8")

    assert register.count("pdfEditorRouteRuntimeScript") == 1
    assert "/js/pdf-editor/route-runtime.js" in register
    assert "PDF 문서 편집기" in editor
    assert "id=\"fileInput\"" in editor
    assert "id=\"previewBtn\"" in editor
    assert "id=\"downloadBtn\"" in editor


def test_integrated_runtime_features_remain_present():
    def read(path: str) -> str:
        return (ROOT / path).read_text(encoding="utf-8")

    page_tools = read("js/pdf-editor/page-productivity.js")
    nup = read("js/pdf-editor/nup-helper.js")
    layout = read("js/pdf-editor/layout-export.js")
    divider = read("js/pdf-editor/divider-helper.js")
    crop = read("js/pdf-editor/crop-marks.js")
    save = read("js/pdf-editor/save-operation.js")
    recovery = read("js/pdf-editor/save-recovery.js")
    session = read("js/pdf-editor/session-save-safety.js")
    file_context = read("js/pdf-editor/file-context-scope.js")

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
    assert "stage: 'multi-source-snapshot-300mb-cost-guard-v2'" in session
    assert "MAX_FILE_BYTES = 200 * 1024 * 1024" in session
    assert "MAX_SESSION_BYTES = 300 * 1024 * 1024" in session
    assert "MAX_SESSION_FILES = 50" in session
    assert "업로드된 임시 파일 정리를 시도했습니다." in session
    assert "stage: 'discontinuous-file-context-actions'" in file_context
    assert "이 파일 전체 시계방향 90° 회전" in file_context
