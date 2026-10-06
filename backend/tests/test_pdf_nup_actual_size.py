from pathlib import Path

import fitz
import pytest
from pydantic import ValidationError

from models.schemas import PdfProcessRequest
from services import pdf_engine


ROOT = Path(__file__).resolve().parents[2]
MM_TO_PT = 72 / 25.4


def _source_pdf(width_mm=105, height_mm=148):
    doc = fitz.open()
    page = doc.new_page(width=width_mm * MM_TO_PT, height=height_mm * MM_TO_PT)
    page.insert_text((10 * MM_TO_PT, 18 * MM_TO_PT), "ACTUAL-NUP", fontsize=12)
    data = doc.tobytes()
    doc.close()
    return data


def _request(width_mm=105, height_mm=148):
    return PdfProcessRequest.model_validate({
        "pages": [
            {"file_index": 0, "page_index": 0},
            {"file_index": 0, "page_index": 0},
            {"file_index": 0, "page_index": 0},
            {"file_index": 0, "page_index": 0},
        ],
        "nup_default": 4,
        "paper": {"width_mm": 210, "height_mm": 297},
        "margin_h_mm": 0,
        "margin_v_mm": 0,
        "gap_mm": 0,
        "placement_width_mm": width_mm,
        "placement_height_mm": height_mm,
    })


def test_actual_size_request_requires_width_and_height_together():
    with pytest.raises(ValidationError, match="가로와 세로를 함께"):
        PdfProcessRequest.model_validate({
            "pages": [{"file_index": 0, "page_index": 0}],
            "placement_width_mm": 105,
        })


def test_four_up_preserves_requested_physical_page_size_and_vector_text():
    result = pdf_engine.process_pdf_bytes([_source_pdf()], _request())
    doc = fitz.open(stream=result, filetype="pdf")
    try:
        assert doc.page_count == 1
        assert doc[0].rect.width == pytest.approx(210 * MM_TO_PT, abs=0.2)
        assert doc[0].rect.height == pytest.approx(297 * MM_TO_PT, abs=0.2)
        spans = [
            span
            for block in doc[0].get_text("dict")["blocks"]
            if "lines" in block
            for line in block["lines"]
            for span in line["spans"]
            if "ACTUAL-NUP" in span["text"]
        ]
        assert len(spans) == 4
        assert all(11.5 <= float(span["size"]) <= 12.5 for span in spans)
    finally:
        doc.close()


def test_actual_size_that_does_not_fit_cell_fails_instead_of_silent_shrink():
    with pytest.raises(ValueError, match="현재 배치 칸에 들어가지 않습니다"):
        pdf_engine.process_pdf_bytes([_source_pdf()], _request(120, 160))


def test_pdf_layout_frontend_exposes_actual_mm_size_controls_and_server_contract():
    index = (ROOT / "pdf-editor" / "index.html").read_text(encoding="utf-8")
    manual = (ROOT / "js" / "program-manuals" / "pdf-editor.js").read_text(encoding="utf-8")

    for marker in (
        "실제 출력크기 지정",
        "actualWidthMm",
        "actualHeightMm",
        "원본 PDF 크기 불러오기",
        "placement_width_mm",
        "placement_height_mm",
        "getActualSizeFit",
        "현재 배치 칸",
    ):
        assert marker in index

    assert "실제 출력 크기" in manual
    assert "가로·세로" in manual
