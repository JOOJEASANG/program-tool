from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROTATION = ROOT / "js" / "design-editor" / "phase12-rotation.js"
OUTPUT = ROOT / "js" / "design-editor" / "output.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_rotation_module_loads_after_project_file_stage():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorRotationScriptV1" in source
    assert "/js/design-editor/phase12-rotation.js?v=20260822-1" in source
    assert source.index("designEditorProjectFileScriptV1") < source.index("designEditorRotationScriptV1")


def test_rotation_supports_text_images_shapes_and_drag_handle():
    source = ROTATION.read_text(encoding="utf-8")
    for marker in (
        ".phase2-extra-object.selected",
        ".design-text.selected",
        "record.item.rotation=normalize(value)",
        "record.node.style.transform=`rotate(${angle}deg)`",
        "phase12-rotation-handle",
        "Math.atan2(event.clientY-rotateDrag.cy,event.clientX-rotateDrag.cx)",
        "if(event.shiftKey)next=Math.round(next/15)*15",
        "data-rotate=\"-90\"",
        "data-rotate=\"0\"",
        "data-rotate=\"90\"",
        "DesignEditorDraftScope?.saveCurrent?.(source)",
        "stage:'selected-element-rotation-controls'",
    ):
        assert marker in source


def test_rotation_module_is_bounded_and_does_not_poll_forever():
    source = ROTATION.read_text(encoding="utf-8")
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "while(angle" not in source
    assert "Number.isFinite(angle)" in source
    assert "((angle+180)%360+360)%360-180" in source
    assert "[180,420,800,1300,2200,3200]" in source


def test_300dpi_output_preserves_rotation_for_all_element_types():
    source = OUTPUT.read_text(encoding="utf-8")
    for marker in (
        "function rotationDegrees(item)",
        "function withRotation(ctx,item,x,y,w,h,draw)",
        "ctx.rotate(angle*Math.PI/180)",
        "const angle=rotationDegrees(item)",
        "withRotation(ctx,item,x,y,w,h,()=>fitImage(ctx,image,item,x,y,w,h))",
        "withRotation(ctx,item,x,y,w,h,()=>{",
        "Number.isFinite(value)",
        "((value+180)%360+360)%360-180",
    ):
        assert marker in source
    assert "while(value" not in source
