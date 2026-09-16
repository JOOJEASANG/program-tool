from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTE = ROOT / "js" / "pdf-editor" / "route-runtime.js"
GUARD = ROOT / "js" / "pdf-editor" / "viewport-lazy-preview-guard.js"


def test_layout_route_uses_updated_lazy_preview_canvas_guard_without_extra_asset():
    source = ROUTE.read_text(encoding="utf-8")
    assert "/js/pdf-editor/viewport-lazy-preview-guard.js?v=20260914-1" in source
    assert "pdfPreviewCanvasActionSyncScriptV1" not in source
    assert "preview-canvas-action-sync.js" not in source
    assert "pdf-editor-route-runtime-manifest-v7-unified-sidebar-actions" in source
    assert "/js/image-pdf-adapter.js?v=20260915-1" in source
    assert "/js/pdf-editor/image-input-bridge.js?v=20260915-2" in source


def test_batch_rotation_sync_targets_right_preview_not_only_sidebar_thumbnails():
    source = GUARD.read_text(encoding="utf-8")
    for marker in (
        "window.PdfEditorPageSelection?.selectedIds",
        "#thumbCtxMenu .ctx-item",
        "includes('회전')",
        "allSelectedRotationsChanged(snapshot)",
        "window.PdfViewportLazyPreview",
        "lazy.requestRender(outputIndex)",
        "typeof triggerPreview === 'function'",
        "typeof schedulePreview === 'function'",
        "canvas-insert-and-right-preview-sync-v3",
    ):
        assert marker in source


def test_large_preview_canvas_insertion_is_not_blocked_by_old_safety_message():
    source = GUARD.read_text(encoding="utf-8")
    assert "enableInsertionControls(root)" in source
    assert "button.disabled = false" in source
    assert "pointer-events:auto!important" in source
    assert "왼쪽 페이지 목록에서 추가해 주세요" not in source
    assert "대용량 구간 미리보기에서는 삽입 위치 오류 방지를 위해" not in source
