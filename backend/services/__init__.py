"""Service package compatibility wiring.

All PDF rendering must pass through the explicit layout engine. ``pdf_ops``
still owns shared layout and decoration helpers, while older imports continue
to receive compatible entrypoints without requiring legacy files on disk.
"""
from __future__ import annotations

import sys

from models.schemas import PdfProcessRequest

from . import pdf_ops as _pdf_ops
from . import pdf_layout_implementation as pdf_individual_margin_patch

# Preserve old imports for tests and compatibility consumers without restoring
# the deleted ``pdf_individual_margin_patch.py`` file.
sys.modules[f"{__name__}.pdf_individual_margin_patch"] = pdf_individual_margin_patch


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
