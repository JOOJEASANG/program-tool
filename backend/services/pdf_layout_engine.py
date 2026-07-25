"""Explicit PDF layout engine entrypoint.

The advanced independent-margin and booklet renderer is loaded through a
neutral implementation module. Any historical compatibility assignment made
while importing that module is immediately replaced by the explicit engine
entrypoint.
"""
from __future__ import annotations

from models.schemas import PdfProcessRequest
from services.pdf_print_marks import apply_print_marks_if_enabled


def process_pdf_bytes(
    file_bytes_list: list[bytes],
    request: PdfProcessRequest,
) -> bytes:
    """Render with the advanced layout implementation, then apply print marks."""
    from services import install_common_engine_entrypoint
    from services.pdf_layout_implementation import process_pdf_with_individual_margins

    # The migrated implementation still contains its historical import-time
    # compatibility assignment. Keep that side effect contained to this import.
    install_common_engine_entrypoint()
    rendered = process_pdf_with_individual_margins(file_bytes_list, request)
    return apply_print_marks_if_enabled(rendered, request)
