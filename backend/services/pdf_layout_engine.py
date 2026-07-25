"""Explicit PDF layout engine entrypoint.

This adapter makes the independent-margin and booklet renderer an intentional
engine dependency instead of relying on application import order to install a
runtime monkeypatch.
"""
from __future__ import annotations

from models.schemas import PdfProcessRequest
from services.pdf_print_marks import apply_print_marks_if_enabled


def process_pdf_bytes(
    file_bytes_list: list[bytes],
    request: PdfProcessRequest,
) -> bytes:
    """Render with the advanced layout implementation, then apply print marks."""
    from services.pdf_individual_margin_patch import process_pdf_with_individual_margins

    rendered = process_pdf_with_individual_margins(file_bytes_list, request)
    return apply_print_marks_if_enabled(rendered, request)
