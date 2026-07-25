"""Service package compatibility wiring.

All PDF rendering must pass through the explicit layout engine. ``pdf_ops``
still owns shared layout and decoration helpers, while older imports continue
to receive a compatible ``process_pdf`` entrypoint.
"""
from __future__ import annotations

from models.schemas import PdfProcessRequest

from . import pdf_ops as _pdf_ops


def _process_pdf_via_common_engine(
    file_bytes_list: list[bytes],
    request: PdfProcessRequest,
) -> bytes:
    """Delegate the compatibility entry point to the explicit layout engine."""
    from .pdf_layout_engine import process_pdf_bytes

    return process_pdf_bytes(file_bytes_list, request)


def install_common_engine_entrypoint() -> None:
    """Install the explicit engine after any compatibility modules have loaded."""
    _pdf_ops.process_pdf = _process_pdf_via_common_engine


install_common_engine_entrypoint()
