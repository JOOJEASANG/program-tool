from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_print_checker_loads_file_relative_preview_controls():
    html = read("print-checker/index.html")
    assert "js/print-checker/file-relative-preview.js?v=20260907-3" in html


def test_preview_offsets_are_based_on_attached_file_ratio():
    js = read("js/print-checker/file-relative-preview.js")
    assert "canvas.width) || baseW) * xPercent / 100" in js
    assert "canvas.height) || baseH) * yPercent / 100" in js
    assert "signedPercent" in js
    assert "AXIS_LIMIT = 25" in js
    assert "window.addEventListener('resize'" in js
    assert "ResizeObserver" in js


def test_only_uploaded_artwork_moves_while_core_guides_stay_fixed():
    js = read("js/print-checker/file-relative-preview.js")
    assert "context.drawImage = function" in js
    assert "isUploadedPreview" in js
    assert "neutralizeCoreTransform" in js
    assert "dispatchSource(sourceX, 0)" in js
    assert "dispatchSource(sourceY, 0)" in js
    assert "dispatchSource(sourceScale, 100)" in js
    assert "코어의 이동/배율은 항상 0 / 0 / 100" in js
    assert "drawX = baseX + (baseW - drawW) / 2 + shiftX" in js
    assert "drawY = baseY + (baseH - drawH) / 2 + shiftY" in js
    assert "printCheckerFileOnlyPreview = 'v3'" in js


def test_preview_scale_is_applied_to_artwork_draw_image_only():
    js = read("js/print-checker/file-relative-preview.js")
    assert "scalePercent / 100" in js
    assert "const drawW = baseW * scale" in js
    assert "const drawH = baseH * scale" in js
    assert "코어 배율은 항상 100%" in js


def test_preview_ui_explains_that_guides_are_fixed():
    js = read("js/print-checker/file-relative-preview.js")
    assert "이동·크기 조절은 첨부 파일에만 적용" in js
    assert "재단선·안전영역·책등·접지선은 고정" in js


def test_cover_preview_loads_live_calculated_spine_dimension():
    html = read("print-checker/index.html")
    js = read("js/print-checker/spine-live-dimension.js")
    assert "js/print-checker/spine-live-dimension.js?v=20260907-1" in html
    assert "state.product !== 'cover'" in js
    assert "api?.__test?.getLayout?.()" in js
    assert "const spineLeft" in js
    assert "const spineWidth" in js
    assert "책등 ${spineMm.toFixed(1)} mm" in js
    assert "fileHasBleed" in js
    assert "ResizeObserver" in js


def test_print_checker_browser_smoke_avoids_large_png_decode_flake():
    smoke = read("tests/browser/print-checker-smoke.html")
    assert "PRINT_CHECKER_SMOKE_PIXEL" in smoke
    assert "HTMLCanvasElement.prototype.toDataURL" in smoke
    assert "작은 정상 PNG" in smoke
