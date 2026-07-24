"""Patch PDF export to support four independent margins and facing-page mirroring."""
from __future__ import annotations

import io
from types import SimpleNamespace

import fitz

from services import pdf_ops


def _margin_value(request, name: str, legacy_name: str, fallback: float) -> float:
    value = getattr(request, name, None)
    if value is None:
        value = getattr(request, legacy_name, fallback)
    return pdf_ops._mm_to_pt_safe(value, fallback, 0.0, 80.0)


def _resolve_layout_margins(request, output_page_idx: int) -> tuple[float, float, float, float]:
    """Return left, right, top, bottom margins in points for one output page."""
    left = _margin_value(request, "margin_left_mm", "margin_h_mm", 10.0)
    right = _margin_value(request, "margin_right_mm", "margin_h_mm", 10.0)
    top = _margin_value(request, "margin_top_mm", "margin_v_mm", 10.0)
    bottom = _margin_value(request, "margin_bottom_mm", "margin_v_mm", 10.0)

    # output_page_idx is zero-based. Page 2, 4, 6... swaps binding/outer margins.
    if bool(getattr(request, "facing_pages", False)) and output_page_idx % 2 == 1:
        left, right = right, left
    return left, right, top, bottom


def _apply_page_numbers_with_layout(
    page: fitz.Page,
    settings,
    output_idx: int,
    total_pages: int,
    page_width: float,
    page_height: float,
    facing_pages: bool,
    layout_margins: tuple[float, float, float, float],
) -> None:
    if not settings.enabled:
        return
    if settings.exclude_first and output_idx == 0:
        return

    page_1based = output_idx + 1
    is_odd = page_1based % 2 == 1
    apply_to = getattr(settings, "apply_to", "all")
    if apply_to == "odd" and not is_odd:
        return
    if apply_to == "even" and is_odd:
        return

    # Keep existing numbering behavior for compatibility with saved projects.
    num = output_idx + settings.start
    if settings.format == "1":
        text = str(num)
    elif settings.format == "1/N":
        text = f"{num}/{total_pages}"
    elif settings.format == "-1-":
        text = f"- {num} -"
    else:
        text = f"- {num}/{total_pages} -"

    color = pdf_ops._hex_to_rgb(settings.color, (0.2, 0.2, 0.2))
    fs = settings.font_size
    pos = settings.position
    if facing_pages and not is_odd:
        if "left" in pos:
            pos = pos.replace("left", "right")
        elif "right" in pos:
            pos = pos.replace("right", "left")

    left_margin, right_margin, top_margin, bottom_margin = layout_margins
    extra_mm = getattr(settings, "margin_mm", None)
    extra = pdf_ops._mm_to_pt_safe(extra_mm, 5.0) if extra_mm is not None else pdf_ops.PN_MARGIN_PT

    # Page numbers never cross the paper margin line. A larger dedicated number
    # margin may still move them farther inward.
    left_anchor = max(left_margin, extra)
    right_anchor = max(right_margin, extra)
    top_anchor = max(top_margin, extra)
    bottom_anchor = max(bottom_margin, extra)

    if "bottom" in pos:
        y = page_height - bottom_anchor - fs * 1.6
    else:
        y = top_anchor

    if "center" in pos:
        rect = fitz.Rect(page_width * 0.25, y, page_width * 0.75, y + fs * 1.8)
        align = fitz.TEXT_ALIGN_CENTER
    elif "right" in pos:
        rect = fitz.Rect(page_width * 0.55, y, page_width - right_anchor, y + fs * 1.8)
        align = fitz.TEXT_ALIGN_RIGHT
    else:
        rect = fitz.Rect(left_anchor, y, page_width * 0.45, y + fs * 1.8)
        align = fitz.TEXT_ALIGN_LEFT

    page.insert_textbox(rect, text, fontsize=fs, fontname="helv", color=color, align=align)


def process_pdf_with_individual_margins(file_bytes_list: list[bytes], request) -> bytes:
    """Build output PDF using independent left/right/top/bottom margins."""
    src_docs = [fitz.open(stream=data, filetype="pdf") for data in file_bytes_list]
    try:
        paper_w_pt = request.paper.width_mm * pdf_ops.MM_TO_PT
        paper_h_pt = request.paper.height_mm * pdf_ops.MM_TO_PT
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
        facing = bool(getattr(request, "facing_pages", False))

        for group in groups:
            first = group[0]
            margins = _resolve_layout_margins(request, output_page_idx)

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
                left, right, top, bottom = margins
                usable_w = paper_w_pt - left - right - (cols - 1) * gap_pt
                usable_h = paper_h_pt - top - bottom - (rows - 1) * gap_pt
                if usable_w <= 1 or usable_h <= 1:
                    left = right = top = bottom = pdf_ops.MARGIN_PT
                    gap_use = pdf_ops.CELL_GAP_PT
                    usable_w = paper_w_pt - left - right - (cols - 1) * gap_use
                    usable_h = paper_h_pt - top - bottom - (rows - 1) * gap_use
                    margins = (left, right, top, bottom)
                else:
                    gap_use = gap_pt

                cell_w = usable_w / cols
                cell_h = usable_h / rows
                for slot_idx, page_info in enumerate(group):
                    if page_info.page_type == "blank":
                        continue
                    col = slot_idx % cols
                    row = slot_idx // cols
                    cell_x0 = left + col * (cell_w + gap_use)
                    cell_y0 = top + row * (cell_h + gap_use)
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
                    fit_rect = pdf_ops._calc_fit_rect(cell_rect, src_rect.width, src_rect.height, rotation)
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
            _apply_page_numbers_with_layout(
                out_page,
                request.page_numbers,
                output_page_idx,
                total_output_pages,
                paper_w_pt,
                paper_h_pt,
                facing,
                margins,
            )
            output_page_idx += 1

        if out_doc.page_count == 0:
            out_doc.close()
            raise ValueError("출력할 페이지가 없습니다. 모든 페이지가 제외되었거나 내용이 없습니다.")

        buffer = io.BytesIO()
        out_doc.save(buffer, garbage=4, deflate=True)
        out_doc.close()
        return buffer.getvalue()
    finally:
        for src_doc in src_docs:
            src_doc.close()


if not getattr(pdf_ops, "_individual_margin_patch_v1", False):
    pdf_ops.process_pdf = process_pdf_with_individual_margins
    pdf_ops._individual_margin_patch_v1 = True
