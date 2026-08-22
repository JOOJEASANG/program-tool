from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "js" / "design-editor" / "output.js"


def test_lossless_pdf_profile_is_user_selectable_without_replacing_standard_output():
    source = OUTPUT.read_text(encoding="utf-8")
    assert 'id="designPdfProfile"' in source
    assert '<option value="standard">표준 PDF · 용량 최적화</option>' in source
    assert '<option value="lossless">고품질 PDF · 무손실 PNG</option>' in source
    assert "return PDF_PROFILES[value]||PDF_PROFILES.standard" in source


def test_lossless_profile_uses_png_pages_and_standard_keeps_jpeg_compression():
    source = OUTPUT.read_text(encoding="utf-8")
    assert "if(profile.id==='lossless')return{data:canvas.toDataURL('image/png'),format:'PNG',compression:undefined}" in source
    assert "canvas.toDataURL('image/jpeg',.96)" in source
    assert "format:'JPEG'" in source
    assert "compression:'FAST'" in source
    assert "pdf.addImage(image.data,image.format,0,0,rendered.totalW,rendered.totalH,undefined,image.compression)" in source


def test_output_does_not_misrepresent_rgb_as_cmyk_or_pdfx():
    source = OUTPUT.read_text(encoding="utf-8")
    assert "현재 출력 색상은 RGB입니다." in source
    assert "colorSpace:'RGB'" in source
    assert "CMYK 출력" not in source
    assert "PDF/X" not in source


def test_both_pdf_profiles_still_use_the_final_print_gate():
    source = OUTPUT.read_text(encoding="utf-8")
    export_pdf = source[source.index("async function exportPdf()"):source.index("function install()")]
    assert "await gate({format:'pdf'})" in export_pdf
    assert export_pdf.index("await gate({format:'pdf'})") < export_pdf.index("const profile=selectedPdfProfile()")
    assert "profile.extension" in export_pdf


def test_lossless_profile_keeps_300dpi_renderer_all_surfaces_and_postrender_verification():
    source = OUTPUT.read_text(encoding="utf-8")
    assert "const DPI=300" in source
    assert "for(let index=0;index<p.surfaces.length;index+=1)" in source
    assert "renderSurface(p,surface)" in source
    assert "verifyRenderedSurface(rendered,spec)" in source
    assert "verifyPdfDocument(pdf,spec,renderedCount)" in source
    assert "stage:'selectable-standard-lossless-300dpi-pdf-output-with-postrender-verification'" in source
