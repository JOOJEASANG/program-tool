from pathlib import Path

import fitz

from models.schemas import PdfProcessRequest
from services.pdf_engine import process_pdf_bytes


def _source_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=200, height=300)
    page.insert_text((30, 50), "print marks")
    data = doc.tobytes()
    doc.close()
    return data


def test_common_engine_applies_print_marks():
    request = PdfProcessRequest.model_validate(
        {
            "pages": [
                {"file_index": 0, "page_index": 0, "page_type": "normal"}
            ],
            "print_marks": {
                "enabled": True,
                "bleed_mm": 3,
                "mark_length_mm": 5,
                "mark_offset_mm": 2,
                "edge_padding_mm": 2,
            },
        }
    )

    result = process_pdf_bytes([_source_pdf()], request)
    doc = fitz.open(stream=result, filetype="pdf")
    try:
        expected_width = request.paper.width_mm * 72 / 25.4
        expected_height = request.paper.height_mm * 72 / 25.4
        assert doc.page_count == 1
        assert doc[0].rect.width > expected_width
        assert doc[0].rect.height > expected_height
    finally:
        doc.close()


def test_legacy_print_marks_patch_is_removed():
    assert not Path("services/pdf_print_marks_patch.py").exists()
