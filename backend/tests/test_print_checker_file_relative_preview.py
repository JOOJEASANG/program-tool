from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_print_checker_loads_layered_file_preview_controls():
    html = read("print-checker/index.html")
    assert "js/print-checker/file-relative-preview.js?v=20260907-5" in html
    assert "css/print-checker.css?v=20260907-4" in html


def test_uploaded_artwork_uses_a_separate_canvas_layer():
    js = read("js/print-checker/file-relative-preview.js")
    css = read("css/print-checker.css")
    assert "FILE_LAYER_ID = 'previewFileLayer'" in js
    assert "GUIDE_LAYER_ID = 'previewGuideLayer'" in js
    assert "STACK_CLASS = 'preview-canvas-stack'" in js
    assert "stack.insertBefore(layer, canvas)" in js
    assert "capturedImage = image" in js
    assert "capturedFrame = { x, y, w, h }" in js
    assert "return undefined" in js
    assert ".preview-canvas-stack #previewCanvas" in css
    assert "#previewFileLayer" in css
    assert "pointer-events:none" in css


def test_core_preview_canvas_never_receives_user_move_or_scale():
    js = read("js/print-checker/file-relative-preview.js")
    assert "neutralizeCoreTransform" in js
    assert "dispatchSource(sourceX, 0)" in js
    assert "dispatchSource(sourceY, 0)" in js
    assert "dispatchSource(sourceScale, 100)" in js
    assert "코어 캔버스는 안내선 계산용" in js
    assert "stopAdjustmentEvent" in js
    assert "event.stopImmediatePropagation()" in js
    assert "replacement.addEventListener('input'" in js
    assert "drawFileLayer();" in js


def test_file_layer_moves_and_scales_without_redrawing_guides():
    js = read("js/print-checker/file-relative-preview.js")
    assert "const shiftX = layer.width * xPercent / 100" in js
    assert "const shiftY = layer.height * yPercent / 100" in js
    assert "const scale = Math.max(0.1, scalePercent / 100)" in js
    assert "const drawW = baseW * scale" in js
    assert "const drawH = baseH * scale" in js
    assert "context.drawImage(capturedImage, drawX, drawY, drawW, drawH)" in js
    assert "context.fillRect = function" in js
    assert "isFullPreviewBackground" in js


def test_visible_guides_use_a_hard_locked_snapshot_layer():
    js = read("js/print-checker/file-relative-preview.js")
    assert "function captureGuideLayer()" in js
    assert "context.drawImage(canvas, 0, 0, guide.width, guide.height)" in js
    assert "canvas.style.opacity = '0'" in js
    assert "guideRefreshRequested" in js
    assert "파일 교체·사양 변경처럼 안내선 갱신이 명시된 경우에만" in js
    assert "printCheckerFileOnlyPreview = 'v5-hard-guide-lock'" in js


def test_live_summary_is_kept_outside_canvas_stack():
    js = read("js/print-checker/file-relative-preview.js")
    assert "function stabilizeStack(stack)" in js
    assert "printCheckerLiveSummary" in js
    assert "stack.parentElement.insertBefore(summary, stack)" in js
    assert "MutationObserver" in js


def test_uploaded_file_can_be_dragged_with_pointer():
    js = read("js/print-checker/file-relative-preview.js")
    assert "layer.addEventListener('pointerdown'" in js
    assert "layer.addEventListener('pointermove'" in js
    assert "layer.addEventListener('pointerup'" in js
    assert "layer.setPointerCapture" in js
    assert "updateFromPointer" in js
    assert "originX: xPercent" in js
    assert "originY: yPercent" in js


def test_preview_ui_explains_fixed_canvas_and_mouse_drag():
    js = read("js/print-checker/file-relative-preview.js")
    assert "안내선과 미리보기 캔버스는 완전히 고정됩니다" in js
    assert "마우스로 끌어 이동" in js


def test_browser_smoke_checks_fixed_guides_and_dragging():
    smoke = read("tests/browser/print-checker-file-only-adjustment-smoke.html")
    runner = read("scripts/run_phase5_browser_smoke.sh")
    assert "fixedCanvas" in smoke
    assert "guidesStillFixed" in smoke
    assert "new PointerEvent('pointermove'" in smoke
    assert "v5-hard-guide-lock" in smoke
    assert "print-checker-file-only-adjustment-smoke.html" in runner


def test_preview_loads_product_wide_live_dimensions_in_toolbar():
    html = read("print-checker/index.html")
    js = read("js/print-checker/spine-live-dimension.js")
    assert "js/print-checker/spine-live-dimension.js?v=20260911-4" in html
    assert "PRODUCT_LABELS" in js
    assert "coverLiveDimensions" in js
    assert "제품 실시간 치수" in js
    assert "data-live-trim-dimension" in js
    assert "data-live-work-dimension" in js
    assert "data-live-spine-dimension" in js
    assert "workW = trimW * 2 + spine + wing * 2 + bleed * 2" in js
    assert "byId('previewZoomToolbar')" in js
    assert "toolbar.prepend(bar)" in js
    assert "wrap.prepend(bar)" not in js
    assert "v4-all-products-toolbar-left" in js
    assert "ResizeObserver" in js


def test_print_checker_browser_smoke_avoids_large_png_decode_flake():
    smoke = read("tests/browser/print-checker-smoke.html")
    assert "PRINT_CHECKER_SMOKE_PIXEL" in smoke
    assert "HTMLCanvasElement.prototype.toDataURL" in smoke
    assert "작은 정상 PNG" in smoke
