"""Explicit PDF layout engine entrypoint."""
from __future__ import annotations

from models.schemas import PdfProcessRequest
from services.pdf_layout_implementation import process_pdf_with_individual_margins
from services.pdf_print_marks import apply_print_marks_if_enabled


def process_pdf_bytes(
    file_bytes_list: list[bytes],
    request: PdfProcessRequest,
) -> bytes:
    """Render with the advanced layout implementation, then apply print marks."""
    rendered = process_pdf_with_individual_margins(file_bytes_list, request)
    return apply_print_marks_if_enabled(rendered, request)
