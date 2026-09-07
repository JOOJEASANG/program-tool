from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_print_checker_loads_file_relative_preview_controls():
    html = read("print-checker/index.html")
    assert "js/print-checker/file-relative-preview.js?v=20260907-1" in html


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
    assert "dispatchSource(sourceX, 0)" in js
    assert "dispatchSource(sourceScale, 100)" in js
    assert "재단선/안전선/접지선 등 화면 기준 안내선은 움직이지 않는다" in js
    assert "drawX = baseX + (baseW - drawW) / 2 + shiftX" in js
    assert "drawY = baseY + (baseH - drawH) / 2 + shiftY" in js


def test_preview_scale_is_applied_to_artwork_draw_image_only():
    js = read("js/print-checker/file-relative-preview.js")
    assert "scalePercent / 100" in js
    assert "const drawW = baseW * scale" in js
    assert "const drawH = baseH * scale" in js
    assert "코어 배율은 항상 100%" in js
