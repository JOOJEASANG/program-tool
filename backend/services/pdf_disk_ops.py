"""Disk-backed PDF processing for large Storage jobs.

This compatibility module keeps the existing service API while delegating all
rendering to the source-agnostic common engine.
"""
from __future__ import annotations

from pathlib import Path

from models.schemas import PdfProcessRequest
from services.pdf_engine import process_pdf_paths


def process_pdf_files(
    source_paths: list[str | Path],
    request: PdfProcessRequest,
    output_path: str | Path,
) -> Path:
    """Build a PDF from local source paths and save directly to ``output_path``."""
    return process_pdf_paths(source_paths, request, output_path)
