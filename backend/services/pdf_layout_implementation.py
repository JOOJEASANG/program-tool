"""Render PDF layouts with independent margins, facing pages, page-number space, and booklet output."""
from __future__ import annotations

import io

import fitz

from services import pdf_ops


def _margin_value(request, name: str, legacy_name: str, fallback: float) -> float:
    value = getattr(request, name, None)
    if value is None:
        value = getattr(request, legacy_name, fallback)
    return pdf_ops._mm_to_pt_safe(value, fallback, 0.0, 80.0)


def _base_layout_margins(request, output_page_idx: int) -> tuple[float, float, float, float]:
    """Return user-entered left, right, top, and bottom margins for one output page."""
    left = _margin_value(request, "margin_left_mm", "margin_h_mm", 10.0)
    right = _margin_value(request, "margin_right_mm", "margin_h_mm", 10.0)
    top = _margin_value(request, "margin_top_mm", "margin_v_mm", 10.0)
    bottom = _margin_value(request, "margin_bottom_mm", "margin_v_mm", 10.0)
    if bool(getattr(request, "facing_pages", False)) and output_page_idx % 2 == 1:
        left, right = right, left
    return left, right, top, bottom


def _page_number_applies(settings, output_page_idx: int) -> bool:
    if not bool(getattr(settings, "enabled", False)):
        return False
    if bool(getattr(settings, "exclude_first", False)) and output_page_idx == 0:
        return False
    is_odd = output_page_idx % 2 == 0
    apply_to = getattr(settings, "apply_to", "all")
    return apply_to == "all" or (apply_to == "odd" and is_odd) or (apply_to == "even" and not is_odd)


def _required_page_number_space(settings) -> float:
    """Return content space required around the number in points."""
    margin_mm = getattr(settings, "margin_mm", None)
    edge = pdf_ops._mm_to_pt_safe(margin_mm, 5.0) if margin_mm is not None else pdf_ops.PN_MARGIN_PT
    font_size = max(6.0, min(72.0, float(getattr(settings, "font_size", 10.0) or 10.0)))
    return min(80.0 * pdf_ops.MM_TO_PT, edge + font_size * 0.8 + 2.0 * pdf_ops.MM_TO_PT)


def _resolve_layout_margins(request, output_page_idx: int) -> tuple[float, float, float, float]:
    """Return content margins, expanding top/bottom when page numbers need room."""
    left, right, top, bottom = _base_layout_margins(request, output_page_idx)
    settings = request.page_numbers
    if bool(getattr(settings, "auto_reserve_space", True)) and _page_number_applies(settings, output_page_idx):
        required = _required_page_number_space(settings)
        position = str(getattr(settings, "position", "bottom-center"))
        if position.startswith("top-"):
            top = max(top, required)
        else:
            bottom = max(bottom, required)
    return left, right, top, bottom


def _page_number_value(settings, output_idx: int, total_pages: int) -> tuple[int, int]:
    """Match the browser preview's numbering, including cover exclusion."""
    offset = 1 if settings.exclude_first else 0
    visible = output_idx + settings.start - offset
    visible_total = max(0, total_pages - offset) + settings.start - 1
    return visible, visible_total


def _group_booklet_pages(page_infos: list, nup: int) -> list[list]:
    """Chunk imposed booklet pages strictly by the selected global N-up.

    Per-page/file overrides, standalone-page flags, and group breaks are intentionally
    ignored in booklet mode. The imposition order already contains the exact blank
    slots required for duplex printing, cutting, and folding.
    """
    size = int(nup)
    if size not in pdf_ops.BOOKLET_STRIPS:
        return pdf_ops._group_by_nup(page_infos, size)
    return [list(page_infos[index:index + size]) for index in range(0, len(page_infos), size)]


def _booklet_layout(nup: int) -> tuple[int, int]:
    """Return the fixed left/right booklet grid for one imposed output side.

    Booklet reordering emits pairs in row-major order: left page, right page, then
    the next strip. Rotating the sheet must not change this logical grid.
    """
    size = int(nup)
    strips = pdf_ops.BOOKLET_STRIPS.get(size)
    if strips is None:
        return pdf_ops.NUP_LAYOUT.get(size, (1, 1))
    return 2, strips


def _apply_page_numbers_with_layout(
    page: fitz.Page,
    settings,
    output_idx: int,
    total_pages: int,
    page_width: float,
    page_height: float,
    facing_pages: bool,
    paper_margins: tuple[float, float, float, float],
) -> None:
    if not _page_number_applies(settings, output_idx):
        return

    page_1based = output_idx + 1
    is_odd = page_1based % 2 == 1
    num, number_total = _page_number_value(settings, output_idx, total_pages)
    if settings.format == "1":
        text = str(num)
    elif settings.format == "1/N":
        text = f"{num}/{number_total}"
    elif settings.format == "-1-":
        text = f"- {num} -"
    else:
        text = f"- {num}/{number_total} -"

    color = pdf_ops._hex_to_rgb(settings.color, (0.2, 0.2, 0.2))
    fs = settings.font_size
    position = settings.position
    if facing_pages and not is_odd:
        if "left" in position:
            position = position.replace("left", "right")
        elif "right" in position:
            position = position.replace("right", "left")

    left_margin, right_margin, top_margin, bottom_margin = paper_margins
    extra_mm = getattr(settings, "margin_mm", None)
    extra = pdf_ops._mm_to_pt_safe(extra_mm, 5.0) if extra_mm is not None else pdf_ops.PN_MARGIN_PT
    left_anchor = max(left_margin, extra)
    right_anchor = max(right_margin, extra)
    top_anchor = max(top_margin, extra)
    bottom_anchor = max(bottom_margin, extra)

    if "bottom" in position:
        y = page_height - bottom_anchor - fs * 1.6
    else:
        y = top_anchor

    if "center" in position:
        rect = fitz.Rect(page_width * 0.25, y, page_width * 0.75, y + fs * 1.8)
        align = fitz.TEXT_ALIGN_CENTER
    elif "right" in position:
        rect = fitz.Rect(page_width * 0.55, y, page_width - right_anchor, y + fs * 1.8)
        align = fitz.TEXT_ALIGN_RIGHT
    else:
        rect = fitz.Rect(left_anchor, y, page_width * 0.45, y + fs * 1.8)
        align = fitz.TEXT_ALIGN_LEFT

    page.insert_textbox(rect, text, fontsize=fs, fontname="helv", color=color, align=align)


def _show_divider_in_cell(
    out_page: fitz.Page,
    page_info,
    cell_rect: fitz.Rect,
    paper_w_pt: float,
    paper_h_pt: float,
) -> None:
    """Render a divider as a logical booklet page inside one imposed cell."""
    temp_doc = fitz.open()
    try:
        pdf_ops._render_divider_page(
            temp_doc,
            page_info.divider_content or "",
            page_info.divider_style or "simple",
            paper_w_pt,
            paper_h_pt,
        )
        out_page.show_pdf_page(cell_rect, temp_doc, 0, keep_proportion=True)
    finally:
        temp_doc.close()


def process_pdf_with_individual_margins(file_bytes_list: list[bytes], request) -> bytes:
    """Build output PDF using independent margins and reliable booklet imposition."""
    src_docs = [fitz.open(stream=data, filetype="pdf") for data in file_bytes_list]
    try:
        paper_w_pt = request.paper.width_mm * pdf_ops.MM_TO_PT
        paper_h_pt = request.paper.height_mm * pdf_ops.MM_TO_PT
        gap_pt = pdf_ops._mm_to_pt_safe(getattr(request, "gap_mm", 5.0), 5.0, 0.0, 50.0)

        active_pages = [page for page in request.pages if not page.excluded]
        booklet_enabled = bool(getattr(request, "booklet", False)) and request.nup_default in pdf_ops.BOOKLET_STRIPS
        if booklet_enabled:
            active_pages = pdf_ops._booklet_reorder(
                active_pages,
                int(request.nup_default),
                paper_w_pt > paper_h_pt,
            )
            groups = _group_booklet_pages(active_pages, int(request.nup_default))
        else:
            groups = pdf_ops._group_by_nup(active_pages, request.nup_default)

        out_doc = fitz.open()
        output_page_idx = 0
        total_output_pages = len(groups)
        facing = bool(getattr(request, "facing_pages", False))

        for group in groups:
            if not group:
                continue
            first = group[0]
            paper_margins = _base_layout_margins(request, output_page_idx)
            margins = _resolve_layout_margins(request, output_page_idx)
            standalone_special = len(group) == 1 and bool(getattr(first, "nup_disabled", False))

            if first.page_type == "blank" and standalone_special:
                pdf_ops._render_blank_page(out_doc, paper_w_pt, paper_h_pt)
                out_page = out_doc[-1]
            elif first.page_type == "divider" and standalone_special:
                pdf_ops._render_divider_page(
                    out_doc,
                    first.divider_content or "",
                    first.divider_style or "simple",
                    paper_w_pt,
                    paper_h_pt,
                )
                out_page = out_doc[-1]
            else:
                effective_nup = int(request.nup_default) if booklet_enabled else (
                    1 if first.nup_disabled else (first.nup_override or request.nup_default)
                )
                if booklet_enabled:
                    cols, rows = _booklet_layout(effective_nup)
                else:
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
                    col = slot_idx % cols
                    row = slot_idx // cols
                    cell_x0 = left + col * (cell_w + gap_use)
                    cell_y0 = top + row * (cell_h + gap_use)
                    cell_rect = fitz.Rect(cell_x0, cell_y0, cell_x0 + cell_w, cell_y0 + cell_h)

                    if page_info.page_type == "blank":
                        continue
                    if page_info.page_type == "divider":
                        _show_divider_in_cell(out_page, page_info, cell_rect, paper_w_pt, paper_h_pt)
                        continue

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
                paper_margins,
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
