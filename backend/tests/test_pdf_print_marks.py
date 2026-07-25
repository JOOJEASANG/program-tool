import fitz
import pytest
from pydantic import ValidationError

from models.schemas import PdfProcessRequest, PrintMarkSettings
from services.pdf_ops import MM_TO_PT
from services.pdf_print_marks import add_print_marks


def _trim_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=210 * MM_TO_PT, height=297 * MM_TO_PT)
    page.insert_text((30, 50), "TRIM-CONTENT", fontsize=14)
    data = doc.tobytes()
    doc.close()
    return data


def test_print_mark_schema_defaults_and_bounds():
    settings = PrintMarkSettings()
    assert settings.enabled is False
    assert settings.bleed_mm == 3
    assert settings.mark_length_mm == 5
    assert settings.mark_offset_mm == 2
    assert settings.edge_padding_mm == 2

    with pytest.raises(ValidationError):
        PrintMarkSettings(bleed_mm=20)
    with pytest.raises(ValidationError):
        PrintMarkSettings(mark_length_mm=1)


def test_pdf_request_accepts_print_mark_settings():
    request = PdfProcessRequest.model_validate(
        {
            "pages": [{"file_index": 0, "page_index": 0}],
            "print_marks": {
                "enabled": True,
                "bleed_mm": 3,
                "mark_length_mm": 5,
                "mark_offset_mm": 2,
                "edge_padding_mm": 2,
            },
        }
    )
    assert request.print_marks.enabled is True
    assert request.print_marks.bleed_mm == 3


def test_print_marks_expand_media_box_and_preserve_trim_content():
    marked = add_print_marks(
        _trim_pdf(),
        PrintMarkSettings(enabled=True, bleed_mm=3, mark_length_mm=5, mark_offset_mm=2, edge_padding_mm=2),
    )
    doc = fitz.open(stream=marked, filetype="pdf")
    try:
        page = doc[0]
        assert page.rect.width / MM_TO_PT == pytest.approx(234, abs=0.05)
        assert page.rect.height / MM_TO_PT == pytest.approx(321, abs=0.05)
        assert page.trimbox.width / MM_TO_PT == pytest.approx(210, abs=0.05)
        assert page.trimbox.height / MM_TO_PT == pytest.approx(297, abs=0.05)
        assert page.bleedbox.width / MM_TO_PT == pytest.approx(216, abs=0.05)
        assert page.bleedbox.height / MM_TO_PT == pytest.approx(303, abs=0.05)
        assert "TRIM-CONTENT" in page.get_text()
        assert page.get_drawings(), "crop mark vector lines should be present"
    finally:
        doc.close()


def test_crop_marks_are_outside_trim_and_bleed_boxes():
    marked = add_print_marks(
        _trim_pdf(),
        PrintMarkSettings(enabled=True, bleed_mm=3, mark_length_mm=5, mark_offset_mm=2, edge_padding_mm=2),
    )
    doc = fitz.open(stream=marked, filetype="pdf")
    try:
        page = doc[0]
        trim = page.trimbox
        bleed = page.bleedbox
        assert bleed.x0 < trim.x0 and bleed.y0 < trim.y0
        assert bleed.x1 > trim.x1 and bleed.y1 > trim.y1
        drawings = page.get_drawings()
        assert sum(len(item.get("items", [])) for item in drawings) >= 8
    finally:
        doc.close()
