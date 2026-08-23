from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HARNESS = ROOT / "tests" / "browser" / "design-editor-pdf-smoke.html"
PDF_RUNNER = ROOT / "scripts" / "run_design_editor_pdf_smoke.sh"
SUITE_RUNNER = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"


def test_stage69_pdf_harness_uses_real_two_surface_output_path_and_final_gate():
    source = HARNESS.read_text(encoding="utf-8")
    assert "history.replaceState(null,'','/design-editor/general.html?browser-pdf-smoke=1&embed=1')" in source
    assert "DesignEditorApp.startProject('flyer-a4')" in source
    assert "spec.widthPx===2551&&spec.heightPx===3579&&spec.surfaceCount===2" in source
    assert "finalCheck.confirmBeforeOutput=async options=>{gateFormat=String(options?.format||'');return true;}" in source
    assert "await DesignEditorOutput.exportPdf()" in source
    assert "gateFormat==='pdf'" in source


def test_stage69_pdf_harness_uses_deterministic_jspdf_container_but_real_page_images():
    source = HARNESS.read_text(encoding="utf-8")
    assert "class BrowserSmokeJsPdf" in source
    assert "window.CoverJsPdfLoader={ensure:async()=>BrowserSmokeJsPdf" in source
    assert "pdf.getNumberOfPages()===2" in source
    assert "pdf.images.length===2" in source
    assert "image.format==='JPEG'" in source
    assert "image.data?.startsWith('data:image/jpeg')" in source
    assert "jpegBytes[0]===0xff&&jpegBytes[1]===0xd8&&jpegBytes[2]===0xff" in source
    assert "Math.abs(image.w-216)<.001&&Math.abs(image.h-303)<.001" in source
    assert "image.compression==='FAST'" in source
    assert "pdf.savedName.endsWith('_300dpi.pdf')" in source


def test_stage69_pdf_runner_requires_page_image_gate_profile_and_geometry_markers():
    source = PDF_RUNNER.read_text(encoding="utf-8")
    assert "--virtual-time-budget=45000" in source
    assert "PASS: two-surface real 300DPI PDF export orchestration" in source
    for marker in (
        'data-pdf-pages="2"',
        'data-pdf-images="2"',
        'data-pdf-gate="pdf"',
        'data-pdf-profile="standard"',
        'data-pdf-width="2551"',
        'data-pdf-height="3579"',
    ):
        assert marker in source


def test_stage69_existing_browser_ci_runs_png_then_pdf_smoke_without_new_dependency():
    suite = SUITE_RUNNER.read_text(encoding="utf-8")
    package = (ROOT / "package.json").read_text(encoding="utf-8").lower()
    assert 'bash "$ROOT_DIR/scripts/run_design_editor_pdf_smoke.sh"' in suite
    assert suite.index("data-exported-png-width") < suite.index("run_design_editor_pdf_smoke.sh")
    assert "jspdf" not in package
    assert "playwright" not in package
    assert "puppeteer" not in package
