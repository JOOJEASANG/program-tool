"""Service package compatibility wiring.

All PDF rendering must pass through the common engine.  ``pdf_ops`` still owns
shared layout and decoration helpers, but its historical byte-rendering entry
point is replaced here so older imports cannot execute the duplicate renderer.
"""
from __future__ import annotations

from models.schemas import PdfProcessRequest

from . import pdf_ops as _pdf_ops


def _process_pdf_via_common_engine(
    file_bytes_list: list[bytes],
    request: PdfProcessRequest,
) -> bytes:
    """Delegate the legacy entry point to the common byte engine."""
    from .pdf_engine import process_pdf_bytes

    return process_pdf_bytes(file_bytes_list, request)


_pdf_ops.process_pdf = _process_pdf_via_common_engine
