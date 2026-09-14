import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTE = ROOT / "js" / "pdf-editor" / "route-runtime.js"
SYNC = ROOT / "js" / "pdf-editor" / "preview-canvas-action-sync.js"
GUARD = ROOT / "js" / "pdf-editor" / "viewport-lazy-preview-guard.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_pdf_preview_canvas_action_sync_behavior.cjs"


def test_layout_route_loads_right_preview_batch_action_sync():
    source = ROUTE.read_text(encoding="utf-8")
    assert "pdfPreviewCanvasActionSyncScriptV1" in source
    assert "/js/pdf-editor/preview-canvas-action-sync.js?v=20260914-1" in source
    assert "app:'layout'" in source
    assert "pdf-editor-route-runtime-manifest-v4-canvas-actions" in source


def test_batch_rotation_sync_targets_right_preview_not_only_sidebar_thumbnails():
    source = SYNC.read_text(encoding="utf-8")
    for marker in (
        "window.PdfEditorPageSelection?.selectedIds",
        "#thumbCtxMenu .ctx-item",
        "label.includes('회전')",
        "allSelectedRotationsChanged(snapshot)",
        "window.PdfViewportLazyPreview",
        "lazy.requestRender(outputIndex)",
        "typeof triggerPreview === 'function'",
        "typeof schedulePreview === 'function'",
        "right-preview-batch-action-sync-v1",
    ):
        assert marker in source


def test_large_preview_canvas_insertion_is_not_blocked_by_old_safety_message():
    source = GUARD.read_text(encoding="utf-8")
    assert "enableInsertionControls(root)" in source
    assert "button.disabled = false" in source
    assert "pointer-events:auto!important" in source
    assert "왼쪽 페이지 목록에서 추가해 주세요" not in source
    assert "대용량 구간 미리보기에서는 삽입 위치 오류 방지를 위해" not in source


def test_right_preview_batch_rotation_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf-preview-canvas-action-sync behavior passed" in result.stdout
