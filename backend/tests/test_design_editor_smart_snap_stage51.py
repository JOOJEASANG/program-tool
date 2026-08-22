from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SMART_SNAP = ROOT / "js" / "design-editor" / "phase19-smart-snap.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_smart_snap_loads_after_canvas_quickbar():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorSmartSnapScriptV1" in source
    assert "/js/design-editor/phase19-smart-snap.js?v=20260822-1" in source
    assert source.index("designEditorCanvasQuickbarScriptV1") < source.index("designEditorSmartSnapScriptV1")


def test_smart_snap_aligns_object_edges_centers_and_equal_gaps():
    source = SMART_SNAP.read_text(encoding="utf-8")
    for marker in (
        "const SNAP_MM=2.2",
        "pointsX=rect=>({left:rect.x,center:rect.x+rect.w/2,right:rect.x+rect.w})",
        "pointsY=rect=>({top:rect.y,middle:rect.y+rect.h/2,bottom:rect.y+rect.h})",
        "bestAlignment(rect,others,'x')",
        "bestAlignment(rect,others,'y')",
        "bestEqualGap(rect,others,'x')",
        "bestEqualGap(rect,others,'y')",
        "간격 맞춤",
        "phase19-smart-guide",
        "phase19-gap-badge",
    ):
        assert marker in source


def test_smart_snap_works_for_text_images_shapes_without_interfering_with_transform_handles():
    source = SMART_SNAP.read_text(encoding="utf-8")
    for marker in (
        ".phase2-extra-object.selected",
        ".design-text.selected",
        "current.elements",
        "current.extras",
        ".phase3-resize-handle,.phase12-rotation-handle,#designCanvasQuickbar",
        "DesignEditorDraftScope?.saveCurrent?.('object-smart-snap')",
        "DesignEditorCanvasQuickbar?.sync?.()",
        "stage:'object-alignment-and-equal-gap-smart-snap'",
    ):
        assert marker in source


def test_smart_snap_is_pointer_driven_without_polling():
    source = SMART_SNAP.read_text(encoding="utf-8")
    assert "pointerdown" in source
    assert "pointermove" in source
    assert "pointerup" in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
