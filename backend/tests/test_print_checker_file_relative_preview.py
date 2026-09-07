from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_print_checker_loads_file_relative_preview_controls():
    html = read("print-checker/index.html")
    assert "js/print-checker/file-relative-preview.js?v=20260907-1" in html


def test_preview_offsets_are_based_on_attached_file_ratio():
    js = read("js/print-checker/file-relative-preview.js")
    assert "width * xPercent / 100" in js
    assert "height * yPercent / 100" in js
    assert "signedPercent" in js
    assert "AXIS_LIMIT = 25" in js
    assert "window.addEventListener('resize'" in js
    assert "ResizeObserver" in js


def test_preview_scale_remains_file_relative_percentage():
    core = read("js/print-checker/print-checker.js")
    assert "_scaleAdj = (Number(event.target.value) || 100) / 100" in core
    assert "const drawW = canvas.width * _scaleAdj" in core
    assert "const drawH = canvas.height * _scaleAdj" in core
