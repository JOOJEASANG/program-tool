from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "js" / "design-editor" / "output.js"
REGISTER = ROOT / "js" / "sw-register.js"


def function_block(source: str, start_marker: str, end_marker: str) -> str:
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]


def test_stage63_output_cache_version_and_public_contract_are_current():
    register = REGISTER.read_text(encoding="utf-8")
    source = OUTPUT.read_text(encoding="utf-8")
    assert "/js/design-editor/output.js?v=20260823-1" in register
    assert "expectedOutputSpec" in source
    assert "verifyRenderedSurface" in source
    assert "verifyPdfDocument" in source
    assert "stage:'selectable-standard-lossless-300dpi-pdf-output-with-postrender-verification'" in source


def test_stage63_expected_spec_recomputes_300dpi_pixels_from_trim_plus_bleed():
    source = OUTPUT.read_text(encoding="utf-8")
    block = function_block(source, "function expectedOutputSpec(p)", "function verificationFailure")
    assert "const bleed=Math.max(0,Number(p?.bleed)||0)" in block
    assert "widthMm=(Number(p?.width)||0)+bleed*2" in block
    assert "heightMm=(Number(p?.height)||0)+bleed*2" in block
    assert "Math.round(widthMm*PX_PER_MM)" in block
    assert "Math.round(heightMm*PX_PER_MM)" in block
    assert "surfaceCount:Array.isArray(p?.surfaces)?p.surfaces.length:0" in block


def test_stage63_rendered_surface_verification_fails_closed_on_pixel_or_mm_mismatch():
    source = OUTPUT.read_text(encoding="utf-8")
    block = function_block(source, "function verifyRenderedSurface(rendered,spec)", "function verifyPdfDocument")
    assert "OUTPUT_VERIFICATION_FAILED" in source
    assert "rendered.canvas.width!==spec.widthPx" in block
    assert "rendered.canvas.height!==spec.heightPx" in block
    assert "Math.abs(actualW-spec.widthMm)>.001" in block
    assert "Math.abs(actualH-spec.heightMm)>.001" in block
    assert "throw verificationFailure" in block


def test_stage63_png_verifies_render_before_download():
    source = OUTPUT.read_text(encoding="utf-8")
    block = function_block(source, "async function exportPng()", "function ensurePdfLoader()")
    assert block.index("const rendered=await renderSurface(p,surface)") < block.index("verifyRenderedSurface(rendered,spec)")
    assert block.index("verifyRenderedSurface(rendered,spec)") < block.index("downloadDataUrl(")
    assert "recordVerificationFailure(error,'png',spec)" in block


def test_stage63_pdf_verifies_each_surface_and_page_count_before_save():
    source = OUTPUT.read_text(encoding="utf-8")
    block = function_block(source, "async function exportPdf()", "function install()")
    assert block.index("rendered=await renderSurface(p,surface)") < block.index("verifyRenderedSurface(rendered,spec)")
    assert block.index("verifyRenderedSurface(rendered,spec)") < block.index("pdf.addImage(")
    assert block.index("const pageCount=verifyPdfDocument(pdf,spec,renderedCount)") < block.index("pdf.save(")
    assert "renderedCount+=1" in block
    assert "recordVerificationFailure(error,'pdf',spec)" in block


def test_stage63_verification_failures_are_local_diagnostics_only():
    source = OUTPUT.read_text(encoding="utf-8")
    block = function_block(source, "function recordVerificationFailure(error,format,spec)", "function loadImage")
    assert "DesignEditorRuntimeDiagnostics?.record?.('output-verification-error'" in block
    assert "fetch(" not in block
    assert "XMLHttpRequest" not in block
    assert "navigator.sendBeacon" not in block
