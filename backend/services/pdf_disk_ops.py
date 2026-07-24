"""Disk-backed PDF processing for large Storage jobs.

This module deliberately reuses the rendering helpers in ``pdf_ops`` so the
output remains identical while source and result PDFs stay on disk instead of
being duplicated in Python byte arrays.
"""
from __future__ import annotations

from pathlib import Path

import fitz

from models.schemas import PdfProcessRequest
import services.pdf_ops as pdf_ops


def process_pdf_files(
    source_paths: list[str | Path],
    request: PdfProcessRequest,
    output_path: str | Path,
) -> Path:
    """Build a PDF from local source paths and save directly to ``output_path``."""
    src_docs: list[fitz.Document] = []
    out_doc: fitz.Document | None = None
    destination = Path(output_path)

    try:
        src_docs = [fitz.open(str(Path(path))) for path in source_paths]

        paper_w_pt = request.paper.width_mm * pdf_ops.MM_TO_PT
        paper_h_pt = request.paper.height_mm * pdf_ops.MM_TO_PT
        margin_h_pt = pdf_ops._mm_to_pt_safe(getattr(request, "margin_h_mm", 10.0), 10.0, 0.0, 80.0)
        margin_v_pt = pdf_ops._mm_to_pt_safe(getattr(request, "margin_v_mm", 10.0), 10.0, 0.0, 80.0)
        gap_pt = pdf_ops._mm_to_pt_safe(getattr(request, "gap_mm", 5.0), 5.0, 0.0, 50.0)

        active_pages = [page for page in request.pages if not page.excluded]
        groups = pdf_ops._group_by_nup(active_pages, request.nup_default)
        if getattr(request, "booklet", False) and request.nup_default in pdf_ops.BOOKLET_STRIPS:
            active_pages = pdf_ops._booklet_reorder(
                active_pages,
                int(request.nup_default),
                paper_w_pt > paper_h_pt,
            )
            groups = pdf_ops._group_by_nup(active_pages, request.nup_default)

        out_doc = fitz.open()
        output_page_idx = 0
        total_output_pages = len(groups)
        facing = getattr(request, "facing_pages", False)

        for group in groups:
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
                effective_nup = 1 if first.nup_disabled else (first.nup_override or request.nup_default)
                cols, rows = pdf_ops.NUP_LAYOUT.get(effective_nup, (1, 1))
                if paper_w_pt > paper_h_pt and cols != rows:
                    cols, rows = rows, cols

                out_page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)
                usable_w = paper_w_pt - 2 * margin_h_pt - (cols - 1) * gap_pt
                usable_h = paper_h_pt - 2 * margin_v_pt - (rows - 1) * gap_pt
                if usable_w <= 1 or usable_h <= 1:
                    usable_w = paper_w_pt - 2 * pdf_ops.MARGIN_PT - (cols - 1) * pdf_ops.CELL_GAP_PT
                    usable_h = paper_h_pt - 2 * pdf_ops.MARGIN_PT - (rows - 1) * pdf_ops.CELL_GAP_PT
                    margin_h_use = margin_v_use = pdf_ops.MARGIN_PT
                    gap_use = pdf_ops.CELL_GAP_PT
                else:
                    margin_h_use, margin_v_use, gap_use = margin_h_pt, margin_v_pt, gap_pt

                cell_w = usable_w / cols
                cell_h = usable_h / rows
                for slot_idx, page_info in enumerate(group):
                    if page_info.page_type == "blank":
                        continue
                    col = slot_idx % cols
                    row = slot_idx // cols
                    cell_x0 = margin_h_use + col * (cell_w + gap_use)
                    cell_y0 = margin_v_use + row * (cell_h + gap_use)
                    cell_rect = fitz.Rect(cell_x0, cell_y0, cell_x0 + cell_w, cell_y0 + cell_h)

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
                    out_page.show_pdf_page(
                        fit_rect,
                        src_doc,
                        page_info.page_index,
                        rotate=rotation,
                        keep_proportion=True,
                    )
                    if request.add_border:
                        shape = out_page.new_shape()
                        shape.draw_rect(fit_rect)
                        shape.finish(color=(0.6, 0.6, 0.6), width=0.5)
                        shape.commit()

            pdf_ops._apply_watermark(out_page, request.watermark)
            pdf_ops._apply_header_footer(
                out_page,
                request.header_footer,
                paper_w_pt,
                paper_h_pt,
                output_page_idx + 1,
                total_output_pages,
                facing,
            )
            pdf_ops._apply_page_numbers(
                out_page,
                request.page_numbers,
                output_page_idx,
                total_output_pages,
                paper_w_pt,
                paper_h_pt,
                facing,
            )
            output_page_idx += 1

        if out_doc.page_count == 0:
            raise ValueError("출력할 페이지가 없습니다. 모든 페이지가 제외되었거나 내용이 없습니다.")

        destination.parent.mkdir(parents=True, exist_ok=True)
        out_doc.save(str(destination), garbage=4, deflate=True)
        return destination
    finally:
        if out_doc is not None:
            out_doc.close()
        for src_doc in src_docs:
            src_doc.close()
