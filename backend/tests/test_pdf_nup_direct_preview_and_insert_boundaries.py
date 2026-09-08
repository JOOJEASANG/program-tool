from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_large_lazy_preview_keeps_blank_and_divider_controls_on_absolute_output_boundaries():
    source = text("js/pdf-editor/preview-insert-persistence.js")

    for marker in (
        "function ensureLazyBoundaries()",
        "function ensureVerticalAfter(face,boundary)",
        "face?.dataset?.outputIndex",
        "makePreviewInsertZone(index)",
        "makeVerticalInsertZone(index)",
        "outputIndex(face,index)+1",
        "const expectedZones=new Set()",
        "if(!expectedZones.has(zone))zone.remove()",
        "pdfPreviewInsertLazyBoundaries",
        "large-document-absolute-insert-boundaries-v3",
        "multi-file-preview-insert-persistence-v2",
        "+ 빈 페이지",
        "+ 간지",
    ):
        assert marker in source

    assert "if(!ensureFastFallback()&&!ensureLazyBoundaries())ensureNormalBoundaries();" in source
    assert "row.querySelectorAll(':scope>.prev-ins-zone-v').forEach(zone=>zone.remove())" not in source


def test_nup_mouse_drag_paints_directly_into_visible_preview_before_final_rerender():
    source = text("js/pdf-editor/nup-direct-preview-edit.js")
    core = text("js/pdf-editor/core-runtime.js")
    advanced = text("js/pdf-editor/advanced-runtime.js")

    for marker in (
        ".pdf-nup-adjust-hit",
        ".pdf-nup-adjust-handle",
        "cloneCanvas(canvas)",
        "cropCell(base,cell)",
        "getBoundingClientRect()",
        "PdfNupPageAdjust?.valuesForPage",
        "ctx.drawImage(state.base,0,0)",
        "ctx.drawImage(state.cellImage,drawX,drawY,drawW,drawH)",
        "pointermove",
        "queueMicrotask",
        "마우스로 위치 이동 중",
        "마우스로 크기 조절 중",
        "live-canvas-direct-manipulation-v1",
    ):
        assert marker in source

    assert "pdfNupDirectPreviewEditScriptV1" not in core
    assert "pdfNupDirectPreviewEditScriptV1" in advanced
    assert "/js/pdf-editor/nup-direct-preview-edit.js?v=20260908-1" in advanced
    assert ".then(()=>loadNupPageAdjust())" in advanced
    assert ".then(()=>loadNupDirectPreviewEdit())" in advanced

    module_block = core.split("const MODULES=Object.freeze([", 1)[1].split("]);", 1)[0]
    assert module_block.count("src:'/js/pdf-editor/") == 8
    assert "pdf-editor-core-runtime-manifest-v1" in core
    assert "pdf-editor-advanced-runtime-v1" in advanced
