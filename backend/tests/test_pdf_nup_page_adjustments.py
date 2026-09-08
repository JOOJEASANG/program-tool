from pathlib import Path

import fitz
import pytest
from pydantic import ValidationError

from models.schemas import PdfProcessRequest
from services import pdf_engine


ROOT = Path(__file__).resolve().parents[2]


def _source_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=300, height=500)
    page.draw_rect(fitz.Rect(85, 180, 215, 320), color=(0, 0, 0), width=1)
    page.insert_text((125, 255), "SCAN-CENTER", fontsize=14)
    data = doc.tobytes()
    doc.close()
    return data


def _request(**page_values) -> PdfProcessRequest:
    page = {"file_index": 0, "page_index": 0}
    page.update(page_values)
    return PdfProcessRequest.model_validate({
        "pages": [page],
        "nup_default": 1,
        "paper": {"width_mm": 210, "height_mm": 297},
        "margin_h_mm": 10,
        "margin_v_mm": 10,
        "gap_mm": 5,
    })


def _word_bbox(pdf_bytes: bytes, text: str) -> fitz.Rect:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for word in doc[0].get_text("words"):
            if word[4] == text:
                return fitz.Rect(word[:4])
    finally:
        doc.close()
    raise AssertionError(f"missing output text: {text}")


def test_page_adjustment_schema_defaults_and_bounds():
    default_page = _request().pages[0]
    assert default_page.content_scale == 1.0
    assert default_page.offset_x_mm == 0.0
    assert default_page.offset_y_mm == 0.0

    bounded = _request(content_scale=3.0, offset_x_mm=200, offset_y_mm=-200).pages[0]
    assert bounded.content_scale == 3.0
    assert bounded.offset_x_mm == 200
    assert bounded.offset_y_mm == -200

    with pytest.raises(ValidationError):
        _request(content_scale=3.01)
    with pytest.raises(ValidationError):
        _request(content_scale=0.49)
    with pytest.raises(ValidationError):
        _request(offset_x_mm=200.01)
    with pytest.raises(ValidationError):
        _request(offset_y_mm=-200.01)


def test_adjusted_page_is_clipped_in_cell_and_preserves_pdf_text():
    source = _source_pdf_bytes()
    result = pdf_engine.process_pdf_bytes(
        [source],
        _request(content_scale=1.35, offset_x_mm=14, offset_y_mm=-9),
    )
    doc = fitz.open(stream=result, filetype="pdf")
    try:
        assert doc.page_count == 1
        assert doc[0].rect.width == pytest.approx(210 * 72 / 25.4, abs=0.2)
        assert doc[0].rect.height == pytest.approx(297 * 72 / 25.4, abs=0.2)
        assert "SCAN-CENTER" in doc[0].get_text()
    finally:
        doc.close()


def test_page_offset_changes_final_output_position():
    source = _source_pdf_bytes()
    baseline = pdf_engine.process_pdf_bytes([source], _request())
    shifted = pdf_engine.process_pdf_bytes(
        [source],
        _request(offset_x_mm=18, offset_y_mm=12),
    )

    baseline_box = _word_bbox(baseline, "SCAN-CENTER")
    shifted_box = _word_bbox(shifted, "SCAN-CENTER")
    assert shifted_box.x0 > baseline_box.x0 + 25
    assert shifted_box.y0 > baseline_box.y0 + 15


def test_client_exposes_mouse_page_adjustment_and_server_contract():
    source = (ROOT / "js" / "pdf-editor" / "nup-page-adjust.js").read_text(encoding="utf-8")
    core = (ROOT / "js" / "pdf-editor" / "core-runtime.js").read_text(encoding="utf-8")

    for marker in (
        "스캔 페이지 위치·크기 보정",
        "pdf-nup-adjust-hit",
        "pdf-nup-adjust-handle",
        "pointerdown",
        "content_scale",
        "offset_x_mm",
        "offset_y_mm",
        "nupPageAdjustments",
        "PdfViewportLazyPreview",
        "interactive-page-scale-pan-v1",
    ):
        assert marker in source

    module_block = core.split("const MODULES=Object.freeze([", 1)[1].split("]);", 1)[0]
    assert module_block.count("src:'/js/pdf-editor/") == 8
    assert "pdfNupPageAdjustScriptV1" in core
    assert ".then(()=>loadNupPageAdjust())" in core
    assert "pdf-editor-core-runtime-manifest-v1" in core


def test_large_pdf_registration_switches_to_lightweight_mode_earlier():
    source = (ROOT / "js" / "pdf-editor" / "upload-fix.js").read_text(encoding="utf-8")

    for marker in (
        "const LIGHTWEIGHT_PAGE_LIMIT = 120",
        "const LIGHTWEIGHT_BYTE_LIMIT = 96 * 1024 * 1024",
        "total >= LIGHTWEIGHT_PAGE_LIMIT",
        "projectedPages >= LIGHTWEIGHT_PAGE_LIMIT",
        "file.size >= LIGHTWEIGHT_BYTE_LIMIT",
        "lightweight: true",
        "await pdfDocument.destroy?.()",
        "hasLightweightPages()",
        "대용량 경량 모드",
    ):
        assert marker in source
