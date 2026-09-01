from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_shared_shell_loads_direct_resize_once_for_all_design_products():
    runtime = (ROOT / "js" / "design-editor" / "shell-runtime.js").read_text(encoding="utf-8")
    assert "designDirectResizeHandlesScriptV1" in runtime
    assert "/js/design-editor/direct-resize-handles.js?v=20260901-1" in runtime
    assert "window.DesignEditorDirectResize?.sync?.()" in runtime
    assert runtime.index("await loadDirectResize()") < runtime.index("await loadProductSpecificWorkspace()")


def test_direct_resize_handles_match_object_type_and_keep_common_engine_contract():
    source = (ROOT / "js" / "design-editor" / "direct-resize-handles.js").read_text(encoding="utf-8")
    assert "const HANDLE_DIRS=['nw','n','ne','e','se','s','sw','w']" in source
    assert "if(record.kind==='text')return['w','e'];" in source
    assert "record.item.shape==='line')return['w','e'];" in source
    assert "state.record.kind==='image'||(state.record.kind==='shape'&&event.shiftKey)" in source
    assert "screenDx*Math.cos(angle)+screenDy*Math.sin(angle)" in source
    assert "localShiftX*Math.cos(angle)-localShiftY*Math.sin(angle)" in source
    assert "document.addEventListener('pointermove',onPointerMove,{capture:true,passive:false})" in source
    assert "window.DesignEditorPhase2?.sync?.()" in source
    assert "window.DesignEditorSelectionContextbar?.sync?.()" in source
    assert "window.DesignEditorRotation?.sync?.()" in source
    assert "programstudio:design-resize" in source


def test_direct_resize_keeps_text_typography_and_image_content_out_of_resize_logic():
    source = (ROOT / "js" / "design-editor" / "direct-resize-handles.js").read_text(encoding="utf-8")
    assert "if(state.record.kind!=='text')item.h=size.h;" in source
    assert "if(state.record.kind!=='text')node.style.height" in source
    assert "record.kind==='text'?`${round(size.w)} mm`" in source
    assert "fontSize" not in source
    assert "naturalWidth" not in source
    assert "item.src=" not in source
