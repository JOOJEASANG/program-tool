from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HARNESS = ROOT / "tests" / "browser" / "design-editor-pdf-lossless-smoke.html"
LOSSLESS_RUNNER = ROOT / "scripts" / "run_design_editor_pdf_lossless_smoke.sh"
STANDARD_RUNNER = ROOT / "scripts" / "run_design_editor_pdf_smoke.sh"


def test_stage70_lossless_harness_uses_actual_lossless_profile_and_two_surface_export():
    source = HARNESS.read_text(encoding="utf-8")
    assert "history.replaceState(null,'','/design-editor/general.html?browser-pdf-lossless-smoke=1&embed=1')" in source
    assert "profile.value='lossless'" in source
    assert "await DesignEditorOutput.exportPdf()" in source
    assert "gateFormat==='pdf'" in source
    assert "pdf.getNumberOfPages()===2&&pdf.images.length===2" in source


def test_stage70_lossless_harness_requires_png_payload_signature_ihdr_and_no_jpeg_compression():
    source = HARNESS.read_text(encoding="utf-8")
    assert "image.format==='PNG'" in source
    assert "image.data?.startsWith('data:image/png;base64,')" in source
    assert "[137,80,78,71,13,10,26,10].every" in source
    assert "view.getUint32(16)===2551&&view.getUint32(20)===3579" in source
    assert "image.compression===undefined" in source
    assert "pdf.savedName.endsWith('_300dpi_lossless.pdf')" in source
    assert "textContent.includes('고품질 PDF')" in source


def test_stage70_lossless_runner_requires_profile_page_image_and_geometry_markers():
    source = LOSSLESS_RUNNER.read_text(encoding="utf-8")
    assert "--virtual-time-budget=60000" in source
    assert "PASS: two-surface lossless PNG-backed 300DPI PDF export orchestration" in source
    for marker in (
        'data-lossless-pages="2"',
        'data-lossless-images="2"',
        'data-lossless-gate="pdf"',
        'data-lossless-profile="lossless"',
        'data-lossless-width="2551"',
        'data-lossless-height="3579"',
    ):
        assert marker in source


def test_stage70_standard_pdf_runner_chains_lossless_profile_smoke():
    source = STANDARD_RUNNER.read_text(encoding="utf-8")
    assert 'bash "$ROOT_DIR/scripts/run_design_editor_pdf_lossless_smoke.sh"' in source
    assert source.index('data-pdf-profile="standard"') < source.index("run_design_editor_pdf_lossless_smoke.sh")
    assert "Design editor PDF profile smoke suite passed" in source
