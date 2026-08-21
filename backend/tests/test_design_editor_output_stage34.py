from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "js" / "design-editor" / "output.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_design_editor_output_is_loaded_for_design_editor():
    register = REGISTER.read_text(encoding="utf-8")
    assert "designEditorOutputScriptV1" in register
    assert "/js/design-editor/output.js?v=20260821-1" in register


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
        "stage:'300dpi-print-output'",
    ):
        assert marker in source


def test_design_editor_output_avoids_runtime_polling_and_eval():
    source = OUTPUT.read_text(encoding="utf-8")
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
