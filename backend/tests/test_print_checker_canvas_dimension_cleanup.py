from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "print-checker" / "index.html"
CLEANUP = ROOT / "js" / "print-checker" / "canvas-dimension-cleanup.js"
CORE = ROOT / "js" / "print-checker" / "print-checker.js"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_canvas_dimension_cleanup_loads_before_core_renderer():
    index = text(INDEX)
    cleanup_path = "/js/print-checker/canvas-dimension-cleanup.js?v=20260911-1"
    core_path = "/js/print-checker/print-checker.js?v=20260904-2"
    assert cleanup_path in index
    assert core_path in index
    assert index.index(cleanup_path) < index.index(core_path)


def test_preview_canvas_suppresses_legacy_mm_dimension_text_only():
    cleanup = text(CLEANUP)
    core = text(CORE)
    assert "canvas?.id === 'previewCanvas'" in cleanup
    assert "DIMENSION_TEXT.test(value)" in cleanup
    assert "v1-header-only-dimensions" in cleanup
    # Legacy renderer still contains these labels for compatibility, but the canvas guard removes their mm line.
    assert "${specs.trimW}mm" in core
    assert "${layout.spineMm}mm" in core
    assert "${specs.trimH || '?'}mm" in core
