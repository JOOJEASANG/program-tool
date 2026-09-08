from pathlib import Path

import fitz
import pytest

from models.schemas import PdfProcessRequest
from services import pdf_engine


ROOT = Path(__file__).resolve().parents[2]
POLISH = ROOT / "js" / "pdf-editor" / "editor-interaction-polish.js"
CORE = ROOT / "js" / "pdf-editor" / "core-runtime.js"
ADVANCED = ROOT / "js" / "pdf-editor" / "advanced-runtime.js"


def _source_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=300, height=500)
    page.insert_text((120, 250), "MARGIN-PROBE", fontsize=14)
    data = doc.tobytes()
    doc.close()
    return data


def _word_x(pdf_bytes: bytes, output_page: int) -> float:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        words = [word for word in doc[output_page].get_text("words") if word[4] == "MARGIN-PROBE"]
        assert words
        return float(words[0][0])
    finally:
        doc.close()


def test_adjusted_pages_keep_asymmetric_margins_and_facing_page_swap():
    source = _source_pdf_bytes()
    request = PdfProcessRequest.model_validate(
        {
            "pages": [
                {
                    "file_index": 0,
                    "page_index": 0,
                    "content_scale": 1.15,
                    "offset_x_mm": 3,
                    "offset_y_mm": -2,
                },
                {
                    "file_index": 0,
                    "page_index": 0,
                    "content_scale": 1.15,
                    "offset_x_mm": 3,
                    "offset_y_mm": -2,
                },
            ],
            "nup_default": 1,
            "paper": {"width_mm": 210, "height_mm": 297},
            "margin_left_mm": 30,
            "margin_right_mm": 5,
            "margin_top_mm": 12,
            "margin_bottom_mm": 8,
            "facing_pages": True,
            "gap_mm": 5,
        }
    )

    result = pdf_engine.process_pdf_bytes([source], request)
    doc = fitz.open(stream=result, filetype="pdf")
    try:
        assert doc.page_count == 2
    finally:
        doc.close()

    odd_x = _word_x(result, 0)
    even_x = _word_x(result, 1)
    assert odd_x > even_x + 45


def test_integrated_preview_builder_combines_margins_and_page_adjustments():
    source = POLISH.read_text(encoding="utf-8")

    assert "layout.layoutMargins(outputIndex)" in source
    assert "output.dataset.marginLeftMm" in source
    assert "output.dataset.marginRightMm" in source
    assert "buildIntegratedOutputPage" in source
    assert "buildIntegratedAllPages" in source
    assert "value.scale" in source
    assert "value.offsetX*ppm" in source
    assert "value.offsetY*ppm" in source
    assert "__pdfMarginNupIntegratedV1" in source
    assert "__pdfNupPageAdjustWrappedV1" in source


def test_sidebar_is_navigation_only_and_contains_no_visual_page_preview():
    source = POLISH.read_text(encoding="utf-8")

    assert "data-pdf-sidebar-page-mode" in source
    assert "number-only" in source
    assert ".thumb-wrap>*:not(.thumb-num){display:none!important}" in source
    assert "item.draggable=false" in source
    assert "event.type==='contextmenu'||event.type==='dragstart'" in source
    assert "페이지 번호 클릭 = 오른쪽 미리보기 화면으로 이동" in source
    assert "편집은 미리보기 화면에서 합니다." in source


def test_resize_handle_uses_radial_distance_for_unambiguous_scale_direction():
    source = POLISH.read_text(encoding="utf-8")

    assert "Math.hypot(event.clientX-centerX,event.clientY-centerY)" in source
    assert "distance/state.startDistance" in source
    assert "direction=next>state.startScale" in source
    assert "'grow'" in source
    assert "'shrink'" in source
    assert "Math.exp((dx-dy)/180)" not in source


def test_polish_loads_in_advanced_runtime_without_changing_lightweight_core_manifest():
    core = CORE.read_text(encoding="utf-8")
    advanced = ADVANCED.read_text(encoding="utf-8")
    module_block = core.split("const MODULES=Object.freeze([", 1)[1].split("]);", 1)[0]

    assert module_block.count("src:'/js/pdf-editor/") == 8
    assert "pdfEditorInteractionPolishScriptV1" not in core
    direct = advanced.index(".then(()=>loadNupDirectPreviewEdit())")
    polish = advanced.index(".then(()=>loadEditorInteractionPolish())")
    assert direct < polish
    assert "pdfEditorInteractionPolishScriptV1" in advanced
    assert "/js/pdf-editor/editor-interaction-polish.js?v=20260908-1" in advanced
    assert "stage:'pdf-editor-core-runtime-manifest-v1'" in core
    assert "stage:'pdf-editor-advanced-runtime-v1'" in advanced
