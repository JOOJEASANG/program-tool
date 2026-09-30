import fitz

from models.advanced_schemas import PdfAdvancedProcessRequest
from services.pdf_advanced_sheet_layout import (
    process_sheet_layout_pdf_bytes,
    request_uses_sheet_layout,
)


def _source_pdf(width=148 / 25.4 * 72, height=210 / 25.4 * 72):
    doc = fitz.open()
    page = doc.new_page(width=width, height=height)
    page.insert_text((20, 30), "ACTUAL-SIZE", fontsize=12)
    page.draw_rect(page.rect, color=(0, 0, 0), width=0.5)
    data = doc.tobytes()
    doc.close()
    return data


def _request(*, crop_marks=False):
    return PdfAdvancedProcessRequest.model_validate({
        "pages": [{
            "file_index": 0,
            "page_index": 0,
            "rotation": 0,
            "output_width_pt": 210 / 25.4 * 72,
            "output_height_pt": 297 / 25.4 * 72,
            "edit_scale": 1,
            "offset_x_mm": 0,
            "offset_y_mm": 0,
            "preserve_actual_size": True,
            "crop_marks": crop_marks,
        }],
    })


def test_sheet_layout_request_is_detected():
    assert request_uses_sheet_layout(_request()) is True


def test_actual_size_source_is_centered_on_larger_a4_sheet_without_enlarging():
    output = process_sheet_layout_pdf_bytes([_source_pdf()], _request())
    doc = fitz.open(stream=output, filetype="pdf")
    try:
        page = doc[0]
        assert abs(page.rect.width - 210 / 25.4 * 72) < 0.5
        assert abs(page.rect.height - 297 / 25.4 * 72) < 0.5
        spans = [span for block in page.get_text("dict")["blocks"] if "lines" in block for line in block["lines"] for span in line["spans"]]
        text_span = next(span for span in spans if "ACTUAL-SIZE" in span["text"])
        assert 11.0 <= float(text_span["size"]) <= 13.0
        expected_left = (page.rect.width - 148 / 25.4 * 72) / 2
        assert text_span["bbox"][0] > expected_left
        assert text_span["bbox"][0] < expected_left + 60
    finally:
        doc.close()


def test_crop_marks_are_drawn_on_sheet_layout_output():
    output = process_sheet_layout_pdf_bytes([_source_pdf()], _request(crop_marks=True))
    doc = fitz.open(stream=output, filetype="pdf")
    try:
        drawings = doc[0].get_drawings()
        line_items = sum(1 for drawing in drawings for item in drawing.get("items", []) if item and item[0] == "l")
        assert line_items >= 8
    finally:
        doc.close()


def test_frontend_paper_module_keeps_source_dimensions_and_exposes_crop_marks():
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    paper = (root / "js" / "pdf-editor-advanced" / "paper-size.js").read_text(encoding="utf-8")
    state = (root / "js" / "pdf-editor-advanced" / "state.js").read_text(encoding="utf-8")
    preview = (root / "js" / "pdf-editor-advanced" / "preview.js").read_text(encoding="utf-8")

    assert "100%가 원본 실제 mm 크기" in paper
    assert "advancedPaperCropMarks" in paper
    assert "preserve_actual_size: sheetMode" in state
    assert "crop_marks: sheetMode" in state
    assert "physicalRotatedPoints" in preview
    assert "drawCropMarks" in preview
    assert "page.widthPt = visibleWidthPt" not in paper
