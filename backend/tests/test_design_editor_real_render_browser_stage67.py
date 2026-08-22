from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HARNESS = ROOT / "tests" / "browser" / "design-editor-smoke.html"
RUNNER = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"


def test_stage67_browser_smoke_calls_real_300dpi_renderer_and_verifies_result():
    source = HARNESS.read_text(encoding="utf-8")
    assert "const actualRendered=await DesignEditorOutput.renderSurface(project,frontSurface)" in source
    assert "DesignEditorOutput.verifyRenderedSurface(actualRendered,spec)===true" in source
    assert "dataset.renderedWidth=String(actualRendered.canvas.width)" in source
    assert "dataset.renderedHeight=String(actualRendered.canvas.height)" in source


def test_stage67_browser_smoke_checks_real_canvas_contains_rendered_ink():
    source = HARNESS.read_text(encoding="utf-8")
    assert "actualRendered.canvas.getContext('2d').getImageData" in source
    assert "let hasInk=false" in source
    assert "assert(hasInk,'real 300DPI render did not contain expected text pixels')" in source
    assert "actualRendered.canvas.width=1" in source
    assert "actualRendered.canvas.height=1" in source


def test_stage67_runner_requires_exact_real_render_dimensions_and_completion_marker():
    source = RUNNER.read_text(encoding="utf-8")
    assert "PASS: core edit, two-surface flow, real 300DPI render, real PNG export, fail-closed verification, full runtime manifest" in source
    assert "data-rendered-width=\"2551\"" in source
    assert "data-rendered-height=\"3579\"" in source
    assert "--virtual-time-budget=30000" in source
