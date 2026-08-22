from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "js" / "design-editor" / "output.js"
REGISTER = ROOT / "js" / "sw-register.js"


def function_block(source: str, start_marker: str, end_marker: str) -> str:
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]


def test_design_editor_output_is_loaded_for_general_editor():
    register = REGISTER.read_text(encoding="utf-8")
    assert "designEditorOutputScriptV1" in register
    assert "/js/design-editor/output.js?v=20260822-4" in register
    source = OUTPUT.read_text(encoding="utf-8")
    assert "path!=='/design-editor/general'" in source
    assert "path!=='/design-editor/general.html'" in source
    assert "path.endsWith('/design-editor/general.html')" in source
    assert "path!=='/design-editor/index.html'" not in source


def test_design_editor_output_keeps_true_300dpi_and_bleed_geometry():
    source = OUTPUT.read_text(encoding="utf-8")
    for marker in (
        "const DPI=300",
        "const PX_PER_MM=DPI/25.4",
        "Number(p.width)+Number(p.bleed||0)*2",
        "Number(p.height)+Number(p.bleed||0)*2",
        "MAX_PIXELS=42000000",
        "300DPI PNG",
        "300DPI PDF",
        "가이드선은 제외하고 재단 여백까지 포함",
    ):
        assert marker in source


def test_design_editor_output_renders_text_images_shapes_and_all_surfaces_to_pdf():
    source = OUTPUT.read_text(encoding="utf-8")
    for marker in (
        "drawText(ctx,item,bleedPx)",
        "drawIcon(ctx,name,x,y,size,color)",
        "surface.elements",
        "surface.extras",
        "fitImage(ctx,image,item,x,y,w,h)",
        "item.shape==='line'",
        "item.shape==='ellipse'",
        "for(let index=0;index<p.surfaces.length;index+=1)",
        "pdf.addPage",
        "CoverJsPdfLoader",
        "stage:'selectable-standard-lossless-300dpi-pdf-output'",
    ):
        assert marker in source


def test_design_editor_output_requires_final_check_before_png_and_pdf():
    source = OUTPUT.read_text(encoding="utf-8")
    png = function_block(source, "async function exportPng()", "function ensurePdfLoader()")
    pdf = function_block(source, "async function exportPdf()", "function install()")
    assert source.count("window.DesignEditorFinalPrintCheck?.confirmBeforeOutput") == 2
    assert "await gate({format:'png'})" in png
    assert png.index("await gate({format:'png'})") < png.index("renderSurface(p,surface)")
    assert "await gate({format:'pdf'})" in pdf
    assert pdf.index("await gate({format:'pdf'})") < pdf.index("for(let index=0;index<p.surfaces.length;index+=1)")


def test_design_editor_pdf_profiles_keep_standard_and_lossless_paths_explicit():
    source = OUTPUT.read_text(encoding="utf-8")
    for marker in (
        "const PDF_PROFILES=Object.freeze",
        "standard:{id:'standard'",
        "lossless:{id:'lossless'",
        "고품질 PDF · 무손실 PNG",
        "현재 출력 색상은 RGB",
        "canvas.toDataURL('image/png')",
        "format:'PNG'",
        "canvas.toDataURL('image/jpeg',.96)",
        "format:'JPEG'",
        "function pdfImagePayload(canvas,profile)",
        "pdf.addImage(image.data,image.format",
        "colorSpace:'RGB'",
    ):
        assert marker in source


def test_design_editor_output_avoids_runtime_polling_and_eval():
    source = OUTPUT.read_text(encoding="utf-8")
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
