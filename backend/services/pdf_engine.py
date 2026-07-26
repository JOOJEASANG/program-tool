"""Source-agnostic PDF rendering engine.

The engine receives already-open PyMuPDF documents. Callers remain responsible
for opening and closing sources and for choosing memory or disk output.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import fitz

from models.schemas import PdfProcessRequest
import services.pdf_ops as pdf_ops
from services import pdf_text_renderer
from services.pdf_print_marks import apply_print_marks_if_enabled, rewrite_path_with_print_marks


EMPTY_SOURCE_PAGE_ERROR = "nothing to show - source page empty"


@dataclass(frozen=True)
class _PageLayout:
    cols: int
    rows: int
    cell_w: float
    cell_h: float
    cell_rects: tuple[fitz.Rect, ...]


def _build_page_layout(
    effective_nup: int,
    paper_w_pt: float,
    paper_h_pt: float,
    margin_h_pt: float,
    margin_v_pt: float,
    gap_pt: float,
) -> _PageLayout:
    """Calculate immutable cell geometry once for a repeated N-up layout."""
    cols, rows = pdf_ops.NUP_LAYOUT.get(effective_nup, (1, 1))
    if paper_w_pt > paper_h_pt and cols != rows:
        cols, rows = rows, cols

    usable_w = paper_w_pt - 2 * margin_h_pt - (cols - 1) * gap_pt
    usable_h = paper_h_pt - 2 * margin_v_pt - (rows - 1) * gap_pt
    if usable_w <= 1 or usable_h <= 1:
        usable_w = paper_w_pt - 2 * pdf_ops.MARGIN_PT - (cols - 1) * pdf_ops.CELL_GAP_PT
        usable_h = paper_h_pt - 2 * pdf_ops.MARGIN_PT - (rows - 1) * pdf_ops.CELL_GAP_PT
        margin_h_use = margin_v_use = pdf_ops.MARGIN_PT
        gap_use = pdf_ops.CELL_GAP_PT
    else:
        margin_h_use = margin_h_pt
        margin_v_use = margin_v_pt
        gap_use = gap_pt

    cell_w = usable_w / cols
    cell_h = usable_h / rows
    rects = []
    for slot_idx in range(cols * rows):
        col = slot_idx % cols
        row = slot_idx // cols
        cell_x0 = margin_h_use + col * (cell_w + gap_use)
        cell_y0 = margin_v_use + row * (cell_h + gap_use)
        rects.append(fitz.Rect(cell_x0, cell_y0, cell_x0 + cell_w, cell_y0 + cell_h))

    return _PageLayout(cols, rows, cell_w, cell_h, tuple(rects))


def _render_source_page(
    out_page: fitz.Page,
    src_docs: list[fitz.Document],
    page_info,
    cell_rect: fitz.Rect,
    cell_w: float,
    cell_h: float,
    add_border: bool,
) -> None:
    src_doc = src_docs[page_info.file_index]
    src_page = src_doc[page_info.page_index]
    src_rect = src_page.rect
    rotation = pdf_ops._best_fit_rotation(
        cell_w,
        cell_h,
        src_rect.width,
        src_rect.height,
        page_info.rotation,
    )
    fit_rect = pdf_ops._calc_fit_rect(
        cell_rect,
        src_rect.width,
        src_rect.height,
        rotation,
    )
    try:
        out_page.show_pdf_page(
            fit_rect,
            src_doc,
            page_info.page_index,
            rotate=rotation,
            keep_proportion=True,
        )
    except ValueError as exc:
        if EMPTY_SOURCE_PAGE_ERROR not in str(exc):
            raise
    if add_border:
        shape = out_page.new_shape()
        shape.draw_rect(fit_rect)
        shape.finish(color=(0.6, 0.6, 0.6), width=0.5)
        shape.commit()


def build_pdf_document(
    src_docs: Iterable[fitz.Document],
    request: PdfProcessRequest,
) -> fitz.Document:
    """Render an output document from open source documents.

    The returned document belongs to the caller and must be closed by it.
    Source documents are never closed here.
    """
    sources = list(src_docs)
    paper_w_pt = request.paper.width_mm * pdf_ops.MM_TO_PT
    paper_h_pt = request.paper.height_mm * pdf_ops.MM_TO_PT
    margin_h_pt = pdf_ops._mm_to_pt_safe(
        getattr(request, "margin_h_mm", 10.0), 10.0, 0.0, 80.0
    )
    margin_v_pt = pdf_ops._mm_to_pt_safe(
        getattr(request, "margin_v_mm", 10.0), 10.0, 0.0, 80.0
    )
    gap_pt = pdf_ops._mm_to_pt_safe(
        getattr(request, "gap_mm", 5.0), 5.0, 0.0, 50.0
    )

    active_pages = [page for page in request.pages if not page.excluded]
    if getattr(request, "booklet", False) and request.nup_default in pdf_ops.BOOKLET_STRIPS:
        active_pages = pdf_ops._booklet_reorder(
            active_pages,
            int(request.nup_default),
            paper_w_pt > paper_h_pt,
        )
    groups = pdf_ops._group_by_nup(active_pages, request.nup_default)

    out_doc = fitz.open()
    total_output_pages = len(groups)
    facing = getattr(request, "facing_pages", False)
    layout_cache: dict[int, _PageLayout] = {}

    try:
        for output_page_idx, group in enumerate(groups):
            first = group[0]
            if first.page_type == "blank":
                pdf_ops._render_blank_page(out_doc, paper_w_pt, paper_h_pt)
                out_page = out_doc[-1]
            elif first.page_type == "divider":
                pdf_ops._render_divider_page(
                    out_doc,
                    first.divider_content or "",
                    first.divider_style or "simple",
                    paper_w_pt,
                    paper_h_pt,
                )
                out_page = out_doc[-1]
            else:
                effective_nup = 1 if first.nup_disabled else (
                    first.nup_override or request.nup_default
                )
                layout = layout_cache.get(effective_nup)
                if layout is None:
                    layout = _build_page_layout(
                        effective_nup,
                        paper_w_pt,
                        paper_h_pt,
                        margin_h_pt,
                        margin_v_pt,
                        gap_pt,
                    )
                    layout_cache[effective_nup] = layout

                out_page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)
                for slot_idx, page_info in enumerate(group):
                    if page_info.page_type == "blank":
                        continue
                    _render_source_page(
                        out_page,
                        sources,
                        page_info,
                        layout.cell_rects[slot_idx],
                        layout.cell_w,
                        layout.cell_h,
                        request.add_border,
                    )

            pdf_text_renderer.apply_watermark(out_page, request.watermark)
            pdf_text_renderer.apply_header_footer(
                out_page,
                request.header_footer,
                paper_w_pt,
                paper_h_pt,
                output_page_idx + 1,
                total_output_pages,
                facing,
            )
            pdf_text_renderer.apply_page_numbers(
                out_page,
                request.page_numbers,
                output_page_idx,
                total_output_pages,
                paper_w_pt,
                paper_h_pt,
                facing,
            )

        if out_doc.page_count == 0:
            raise ValueError(
                "출력할 페이지가 없습니다. 모든 페이지가 제외되었거나 내용이 없습니다."
            )
        return out_doc
    except Exception:
        out_doc.close()
        raise


def process_pdf_bytes(
    file_bytes_list: list[bytes],
    request: PdfProcessRequest,
) -> bytes:
    """Open byte sources, render with the common engine, and return PDF bytes."""
    src_docs: list[fitz.Document] = []
    out_doc: fitz.Document | None = None
    try:
        src_docs = [fitz.open(stream=data, filetype="pdf") for data in file_bytes_list]
        out_doc = build_pdf_document(src_docs, request)
        buffer = io.BytesIO()
        out_doc.save(buffer, garbage=4, deflate=True)
        return apply_print_marks_if_enabled(buffer.getvalue(), request)
    finally:
        if out_doc is not None:
            out_doc.close()
        for src_doc in src_docs:
            src_doc.close()


def process_pdf_paths(
    source_paths: list[str | Path],
    request: PdfProcessRequest,
    output_path: str | Path,
) -> Path:
    """Open path sources, render with the common engine, and save to disk."""
    src_docs: list[fitz.Document] = []
    out_doc: fitz.Document | None = None
    destination = Path(output_path)
    try:
        src_docs = [fitz.open(str(Path(path))) for path in source_paths]
        out_doc = build_pdf_document(src_docs, request)
        destination.parent.mkdir(parents=True, exist_ok=True)
        out_doc.save(str(destination), garbage=4, deflate=True)
        return rewrite_path_with_print_marks(destination, request)
    finally:
        if out_doc is not None:
            out_doc.close()
        for src_doc in src_docs:
            src_doc.close()
