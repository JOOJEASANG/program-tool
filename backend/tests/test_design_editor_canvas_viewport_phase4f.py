from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_design_editor_exposes_coordinate_safe_viewport_api():
    source = read("js/design-editor/app.js")
    assert "const CSS_PX_PER_MM=96/25.4;" in source
    assert "let viewportMode='fit';" in source
    assert "manualPpm=CSS_PX_PER_MM*(percent/100);" in source
    assert "ppm=viewportMode==='manual'?" in source
    assert "const dx=(event.clientX-drag.startX)/Math.max(.001,ppm)" in source
    assert "stage:'design-editor-viewport-api-v1'" in source
    assert "setZoom:setZoomPercent" in source
    assert "fit:fitViewport" in source
    assert "actual:actualViewport" in source
    assert "center:centerViewport" in source


def test_canvas_toolbar_is_shared_and_loaded_as_surface_enhancement():
    toolbar = read("js/design-editor/shared/canvas-viewport-toolbar.js")
    loader = read("js/program-studio-ui-v2.js")
    runner = read("scripts/run_design_editor_browser_smoke.sh")
    smoke = read("tests/browser/design-editor-canvas-viewport-smoke.html")

    assert "design-editor-canvas-viewport-toolbar-v1" in toolbar
    assert "DesignEditorApp?.viewport" in toolbar
    assert "designCanvasViewportStage" in toolbar
    assert "data-canvas-view-action=\"fit\"" in toolbar
    assert "data-canvas-view-action=\"actual\"" in toolbar
    assert "data-canvas-view-action=\"center\"" in toolbar
    assert "/js/design-editor/shared/canvas-viewport-toolbar.js?v=20260901-1" in loader
    assert "loadDesignCanvasViewportToolbar();" in loader
    assert "run_design_editor_canvas_viewport_smoke.sh" in runner
    assert "dataset.canvasViewportCoordinates='pass'" in smoke
