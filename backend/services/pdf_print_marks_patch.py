"""Add professional crop marks and reserved bleed workspace to generated PDFs."""
from __future__ import annotations

import io

import fitz

from services import pdf_ops


_ORIGINAL_PROCESS_PDF = pdf_ops.process_pdf


def _safe_mm(value, fallback: float, minimum: float, maximum: float) -> float:
    try:
        number = float(value)
    except Exception:
        number = fallback
    return max(minimum, min(maximum, number))


def _mark_geometry(settings) -> tuple[float, float, float, float]:
    bleed = _safe_mm(getattr(settings, "bleed_mm", 3.0), 3.0, 0.0, 15.0) * pdf_ops.MM_TO_PT
    length = _safe_mm(getattr(settings, "mark_length_mm", 5.0), 5.0, 2.0, 15.0) * pdf_ops.MM_TO_PT
    offset = _safe_mm(getattr(settings, "mark_offset_mm", 2.0), 2.0, 0.0, 10.0) * pdf_ops.MM_TO_PT
    padding = _safe_mm(getattr(settings, "edge_padding_mm", 2.0), 2.0, 0.0, 10.0) * pdf_ops.MM_TO_PT
    outer = padding + length + offset + bleed
    return bleed, length, offset, outer


def _draw_crop_marks(page: fitz.Page, trim: fitz.Rect, bleed: float, length: float, offset: float) -> None:
    """Draw eight crop-mark segments outside the bleed area."""
    x0, y0, x1, y1 = trim.x0, trim.y0, trim.x1, trim.y1
    horizontal_left_end = x0 - bleed - offset
    horizontal_left_start = horizontal_left_end - length
    horizontal_right_start = x1 + bleed + offset
    horizontal_right_end = horizontal_right_start + length
    vertical_top_end = y0 - bleed - offset
    vertical_top_start = vertical_top_end - length
    vertical_bottom_start = y1 + bleed + offset
    vertical_bottom_end = vertical_bottom_start + length

    shape = page.new_shape()
    # Horizontal marks at the top and bottom trim edges.
    shape.draw_line(fitz.Point(horizontal_left_start, y0), fitz.Point(horizontal_left_end, y0))
    shape.draw_line(fitz.Point(horizontal_right_start, y0), fitz.Point(horizontal_right_end, y0))
    shape.draw_line(fitz.Point(horizontal_left_start, y1), fitz.Point(horizontal_left_end, y1))
    shape.draw_line(fitz.Point(horizontal_right_start, y1), fitz.Point(horizontal_right_end, y1))
    # Vertical marks at the left and right trim edges.
    shape.draw_line(fitz.Point(x0, vertical_top_start), fitz.Point(x0, vertical_top_end))
    shape.draw_line(fitz.Point(x1, vertical_top_start), fitz.Point(x1, vertical_top_end))
    shape.draw_line(fitz.Point(x0, vertical_bottom_start), fitz.Point(x0, vertical_bottom_end))
    shape.draw_line(fitz.Point(x1, vertical_bottom_start), fitz.Point(x1, vertical_bottom_end))
    shape.finish(color=(0, 0, 0), width=0.35)
    shape.commit()


def add_print_marks(pdf_bytes: bytes, settings) -> bytes:
    """Wrap each finished page in a larger media box with trim/bleed boxes and crop marks."""
    source = fitz.open(stream=pdf_bytes, filetype="pdf")
    output = fitz.open()
    try:
        bleed, length, offset, outer = _mark_geometry(settings)
        for page_index in range(source.page_count):
            source_page = source[page_index]
            trim_width = source_page.rect.width
            trim_height = source_page.rect.height
            media_width = trim_width + outer * 2
            media_height = trim_height + outer * 2
            output_page = output.new_page(width=media_width, height=media_height)
            trim = fitz.Rect(outer, outer, outer + trim_width, outer + trim_height)
            output_page.show_pdf_page(trim, source, page_index, keep_proportion=False)

            bleed_box = fitz.Rect(
                trim.x0 - bleed,
                trim.y0 - bleed,
                trim.x1 + bleed,
                trim.y1 + bleed,
            )
            try:
                output_page.set_trimbox(trim)
                output_page.set_bleedbox(bleed_box)
            except Exception:
                # Older PyMuPDF builds may not expose all page-box setters.
                pass
            _draw_crop_marks(output_page, trim, bleed, length, offset)

        buffer = io.BytesIO()
        output.save(buffer, garbage=4, deflate=True)
        return buffer.getvalue()
    finally:
        output.close()
        source.close()


def process_pdf_with_print_marks(file_bytes_list: list[bytes], request) -> bytes:
    generated = _ORIGINAL_PROCESS_PDF(file_bytes_list, request)
    settings = getattr(request, "print_marks", None)
    if not settings or not bool(getattr(settings, "enabled", False)):
        return generated
    return add_print_marks(generated, settings)


pdf_ops.add_print_marks = add_print_marks
pdf_ops._print_marks_patch_v1 = True
pdf_ops.process_pdf = process_pdf_with_print_marks
