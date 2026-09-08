"""Source-agnostic PDF rendering engine.

The engine receives already-open PyMuPDF documents. Callers remain responsible
for opening and closing sources and for choosing memory or disk output.
"""
from __future__ import annotations

import io
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import fitz

from models.schemas import PdfProcessRequest
import services.pdf_ops as pdf_ops
from services import pdf_divider_renderer, pdf_text_renderer
from services.pdf_print_marks import (
    apply_print_marks_if_enabled,
    rewrite_path_with_print_marks,
)


EMPTY_SOURCE_PAGE_ERROR = "nothing to show - source page empty"


@dataclass(frozen=True)
class _PageLayout:
    cols: int
    rows: int
    cell_w: float
    cell_h: float
    cell_rects: tuple[fitz.Rect, ...]


def _margin_value(request, name: str, legacy_name: str, fallback: float) -> float:
    value = getattr(request, name, None)
    if value is None:
        value = getattr(request, legacy_name, fallback)
    return pdf_ops._mm_to_pt_safe(value, fallback, 0.0, 80.0)


def _base_layout_margins(
    request: PdfProcessRequest, output_page_idx: int
) -> tuple[float, float, float, float]:
    """Return user-entered left, right, top, and bottom margins."""
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
    return (
        apply_to == "all"
        or (apply_to == "odd" and is_odd)
        or (apply_to == "even" and not is_odd)
    )


def _required_page_number_space(settings, paper_edge_pt: float) -> float:
    margin_mm = getattr(settings, "margin_mm", None)
    dedicated = (
        pdf_ops._mm_to_pt_safe(margin_mm, 5.0)
        if margin_mm is not None
        else pdf_ops.PN_MARGIN_PT
    )
    anchor = max(paper_edge_pt, dedicated)
    font_size = max(
        5.0,
        min(72.0, float(getattr(settings, "font_size", 10.0) or 10.0)),
    )
    return min(
        80.0 * pdf_ops.MM_TO_PT,
        anchor + font_size * 1.8 + 2.0 * pdf_ops.MM_TO_PT,
    )


def _resolve_layout_margins(
    request: PdfProcessRequest, output_page_idx: int
) -> tuple[float, float, float, float]:
    """Expand content margins when page numbers need a protected area."""
    left, right, top, bottom = _base_layout_margins(request, output_page_idx)
    settings = request.page_numbers
    if (
        bool(getattr(settings, "auto_reserve_space", True))
        and _page_number_applies(settings, output_page_idx)
    ):
        position = str(getattr(settings, "position", "bottom-center"))
        if position.startswith("top-"):
            top = max(top, _required_page_number_space(settings, top))
        else:
            bottom = max(bottom, _required_page_number_space(settings, bottom))
    return left, right, top, bottom


def _booklet_layout(nup: int) -> tuple[int, int]:
    strips = pdf_ops.BOOKLET_STRIPS.get(int(nup))
    if strips is None:
        return pdf_ops.NUP_LAYOUT.get(int(nup), (1, 1))
    return 2, strips


def _build_page_layout(
    effective_nup: int,
    paper_w_pt: float,
    paper_h_pt: float,
    margins: tuple[float, float, float, float] | float,
    gap_pt: float,
    page_order: str | float = "row-major",
    booklet: bool = False,
) -> _PageLayout:
    """Calculate immutable cell geometry for one output page.

    The historical internal signature was ``(nup, w, h, margin_h, margin_v,
    gap)``. Numeric ``margins`` keeps that call shape working while new callers
    pass a four-value margin tuple and an explicit page order.
    """
    if isinstance(margins, (tuple, list)) and len(margins) == 4:
        resolved_margins = tuple(float(value) for value in margins)
        resolved_gap = float(gap_pt)
        resolved_order = str(page_order)
    else:
        margin_h = float(margins)
        margin_v = float(gap_pt)
        resolved_gap = float(page_order)
        resolved_margins = (margin_h, margin_h, margin_v, margin_v)
        resolved_order = "row-major"

    if booklet:
        cols, rows = _booklet_layout(effective_nup)
    else:
        cols, rows = pdf_ops.NUP_LAYOUT.get(effective_nup, (1, 1))
        if paper_w_pt > paper_h_pt and cols != rows:
            cols, rows = rows, cols

    left, right, top, bottom = resolved_margins
    usable_w = paper_w_pt - left - right - (cols - 1) * resolved_gap
    usable_h = paper_h_pt - top - bottom - (rows - 1) * resolved_gap
    if usable_w <= 1 or usable_h <= 1:
        left = right = top = bottom = pdf_ops.MARGIN_PT
        gap_use = pdf_ops.CELL_GAP_PT
        usable_w = paper_w_pt - left - right - (cols - 1) * gap_use
        usable_h = paper_h_pt - top - bottom - (rows - 1) * gap_use
    else:
        gap_use = resolved_gap

    cell_w = usable_w / cols
    cell_h = usable_h / rows
    rects: list[fitz.Rect] = []
    column_major = resolved_order == "column-major" and not booklet
    for slot_idx in range(cols * rows):
        if column_major:
            col = slot_idx // rows
            row = slot_idx % rows
        else:
            col = slot_idx % cols
            row = slot_idx // cols
        cell_x0 = left + col * (cell_w + gap_use)
        cell_y0 = top + row * (cell_h + gap_use)
        rects.append(
            fitz.Rect(cell_x0, cell_y0, cell_x0 + cell_w, cell_y0 + cell_h)
        )

    return _PageLayout(cols, rows, cell_w, cell_h, tuple(rects))


def _page_has_placement_adjustment(page_info) -> bool:
    scale = float(getattr(page_info, "content_scale", 1.0) or 1.0)
    offset_x = float(getattr(page_info, "offset_x_mm", 0.0) or 0.0)
    offset_y = float(getattr(page_info, "offset_y_mm", 0.0) or 0.0)
    return (
        abs(scale - 1.0) > 1e-6
        or abs(offset_x) > 1e-6
        or abs(offset_y) > 1e-6
    )


def _page_clip_rect(src_rect: fitz.Rect, page_info) -> fitz.Rect:
    """Resolve split + non-destructive crop before rotation and placement."""
    base = fitz.Rect(src_rect)
    split_side = getattr(page_info, "split_side", None)
    if split_side in {"left", "right"}:
        midpoint = base.x0 + base.width / 2
        base = fitz.Rect(
            base.x0 if split_side == "left" else midpoint,
            base.y0,
            midpoint if split_side == "left" else base.x1,
            base.y1,
        )

    left = float(getattr(page_info, "crop_left_ratio", 0.0) or 0.0)
    top = float(getattr(page_info, "crop_top_ratio", 0.0) or 0.0)
    right = float(getattr(page_info, "crop_right_ratio", 0.0) or 0.0)
    bottom = float(getattr(page_info, "crop_bottom_ratio", 0.0) or 0.0)
    width = base.width
    height = base.height
    clip = fitz.Rect(
        base.x0 + width * left,
        base.y0 + height * top,
        base.x1 - width * right,
        base.y1 - height * bottom,
    )
    if clip.width <= 1e-6 or clip.height <= 1e-6:
        return base
    return clip


def _resolve_page_rotation(
    page_info,
    cell_w: float,
    cell_h: float,
    clip_rect: fitz.Rect,
) -> float:
    """Resolve quarter-turn + fine rotation, preserving legacy auto-fit when untouched."""
    base_rotation = int(getattr(page_info, "rotation", 0) or 0) % 360
    fine_rotation = float(getattr(page_info, "fine_rotation_deg", 0.0) or 0.0)
    requested = (base_rotation + fine_rotation) % 360.0
    if bool(getattr(page_info, "rotation_locked", False)) or abs(fine_rotation) > 1e-9:
        return requested
    return float(pdf_ops._best_fit_rotation(
        cell_w,
        cell_h,
        clip_rect.width,
        clip_rect.height,
        base_rotation,
    ))


def _calc_rotated_fit_rect(
    cell_rect: fitz.Rect,
    src_w: float,
    src_h: float,
    rotation: float,
) -> fitz.Rect:
    """Fit the axis-aligned bounds of an arbitrarily rotated source in a cell."""
    if src_w <= 0 or src_h <= 0:
        return fitz.Rect(cell_rect)
    radians = math.radians(float(rotation) % 360.0)
    cosine = abs(math.cos(radians))
    sine = abs(math.sin(radians))
    bound_w = src_w * cosine + src_h * sine
    bound_h = src_w * sine + src_h * cosine
    if bound_w <= 1e-9 or bound_h <= 1e-9:
        return fitz.Rect(cell_rect)
    scale = min(cell_rect.width / bound_w, cell_rect.height / bound_h)
    fitted_w = bound_w * scale
    fitted_h = bound_h * scale
    x0 = cell_rect.x0 + (cell_rect.width - fitted_w) / 2
    y0 = cell_rect.y0 + (cell_rect.height - fitted_h) / 2
    return fitz.Rect(x0, y0, x0 + fitted_w, y0 + fitted_h)


def _show_source_page(
    target_page: fitz.Page,
    target_rect: fitz.Rect,
    src_doc: fitz.Document,
    page_index: int,
    rotation: float,
    clip_rect: fitz.Rect,
) -> None:
    try:
        target_page.show_pdf_page(
            target_rect,
            src_doc,
            page_index,
            rotate=rotation,
            keep_proportion=True,
            clip=clip_rect,
        )
    except ValueError as exc:
        if EMPTY_SOURCE_PAGE_ERROR not in str(exc):
            raise


def _render_adjusted_source_page(
    out_page: fitz.Page,
    src_doc: fitz.Document,
    page_info,
    cell_rect: fitz.Rect,
    clip_rect: fitz.Rect,
    rotation: float,
) -> None:
    """Render one adjusted source through a cell-sized PDF clipping surface.

    Scaling above 100% intentionally pushes content outside the temporary page;
    the temporary page clips that overflow before it is placed into the final
    N-up cell. This prevents one scanned page from covering a neighbouring slot.
    """
    local_cell = fitz.Rect(0, 0, cell_rect.width, cell_rect.height)
    local_fit = _calc_rotated_fit_rect(
        local_cell,
        clip_rect.width,
        clip_rect.height,
        rotation,
    )
    scale = float(getattr(page_info, "content_scale", 1.0) or 1.0)
    offset_x = float(getattr(page_info, "offset_x_mm", 0.0) or 0.0) * pdf_ops.MM_TO_PT
    offset_y = float(getattr(page_info, "offset_y_mm", 0.0) or 0.0) * pdf_ops.MM_TO_PT
    center_x = (local_fit.x0 + local_fit.x1) / 2 + offset_x
    center_y = (local_fit.y0 + local_fit.y1) / 2 + offset_y
    width = local_fit.width * scale
    height = local_fit.height * scale
    adjusted_rect = fitz.Rect(
        center_x - width / 2,
        center_y - height / 2,
        center_x + width / 2,
        center_y + height / 2,
    )

    temp_doc = fitz.open()
    try:
        temp_page = temp_doc.new_page(width=cell_rect.width, height=cell_rect.height)
        _show_source_page(
            temp_page,
            adjusted_rect,
            src_doc,
            page_info.page_index,
            rotation,
            clip_rect,
        )
        out_page.show_pdf_page(
            cell_rect,
            temp_doc,
            0,
            keep_proportion=False,
        )
    finally:
        temp_doc.close()


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
    # The browser editor intentionally renders every source canvas at rotation 0
    # and then applies user/auto rotation itself. PyMuPDF's page.rect, however,
    # includes the PDF page's intrinsic /Rotate metadata while show_pdf_page does
    # not apply that metadata the same way. Normalize it here so 1-up portrait
    # previews and downloaded vector PDFs use the exact same source geometry.
    if int(getattr(src_page, "rotation", 0) or 0) % 360:
        src_page.set_rotation(0)
    clip_rect = _page_clip_rect(src_page.rect, page_info)
    rotation = _resolve_page_rotation(
        page_info,
        cell_w,
        cell_h,
        clip_rect,
    )
    fit_rect = _calc_rotated_fit_rect(
        cell_rect,
        clip_rect.width,
        clip_rect.height,
        rotation,
    )
    adjusted = _page_has_placement_adjustment(page_info)
    if adjusted:
        _render_adjusted_source_page(
            out_page,
            src_doc,
            page_info,
            cell_rect,
            clip_rect,
            rotation,
        )
    else:
        _show_source_page(
            out_page,
            fit_rect,
            src_doc,
            page_info.page_index,
            rotation,
            clip_rect,
        )
    if add_border:
        shape = out_page.new_shape()
        shape.draw_rect(cell_rect if adjusted else fit_rect)
        shape.finish(color=(0.6, 0.6, 0.6), width=0.5)
        shape.commit()


def _render_divider_in_cell(
    out_page: fitz.Page,
    page_info,
    cell_rect: fitz.Rect,
    paper_w_pt: float,
    paper_h_pt: float,
) -> None:
    temp_doc = fitz.open()
    try:
        pdf_divider_renderer.render_divider_page(
            temp_doc,
            page_info.divider_content or "",
            page_info.divider_style or "simple",
            paper_w_pt,
            paper_h_pt,
        )
        out_page.show_pdf_page(cell_rect, temp_doc, 0, keep_proportion=True)
    finally:
        temp_doc.close()


def _booklet_groups(active_pages: list, nup: int) -> list[list]:
    imposed = pdf_ops._booklet_reorder(active_pages, nup)
    return [
        imposed[index:index + nup]
        for index in range(0, len(imposed), nup)
    ]


def _layout_cache_key(
    effective_nup: int,
    margins: tuple[float, float, float, float],
    gap_pt: float,
    page_order: str,
    booklet: bool,
) -> tuple:
    return (
        int(effective_nup),
        tuple(round(float(value), 6) for value in margins),
        round(float(gap_pt), 6),
        page_order,
        bool(booklet),
    )


def build_pdf_document(
    src_docs: Iterable[fitz.Document],
    request: PdfProcessRequest,
) -> fitz.Document:
    """Render an output document from open source documents."""
    sources = list(src_docs)
    paper_w_pt = request.paper.width_mm * pdf_ops.MM_TO_PT
    paper_h_pt = request.paper.height_mm * pdf_ops.MM_TO_PT
    gap_pt = pdf_ops._mm_to_pt_safe(
        getattr(request, "gap_mm", 5.0), 5.0, 0.0, 50.0
    )

    active_pages = [page for page in request.pages if not page.excluded]
    if not active_pages:
        raise ValueError("출력할 페이지가 없습니다.")
    booklet_enabled = (
        bool(getattr(request, "booklet", False))
        and request.nup_default in pdf_ops.BOOKLET_STRIPS
    )
    if booklet_enabled:
        groups = _booklet_groups(active_pages, int(request.nup_default))
    else:
        groups = pdf_ops._group_by_nup(active_pages, request.nup_default)

    out_doc = fitz.open()
    total_output_pages = len(groups)
    facing = bool(getattr(request, "facing_pages", False))
    page_order = str(getattr(request, "page_order", "row-major"))
    layout_cache: dict[tuple, _PageLayout] = {}

    try:
        for output_page_idx, group in enumerate(groups):
            if not group:
                continue
            first = group[0]
            paper_margins = _base_layout_margins(request, output_page_idx)
            content_margins = _resolve_layout_margins(request, output_page_idx)
            standalone_special = (
                len(group) == 1 and bool(getattr(first, "nup_disabled", False))
            )

            if first.page_type == "blank" and standalone_special:
                pdf_ops._render_blank_page(out_doc, paper_w_pt, paper_h_pt)
                out_page = out_doc[-1]
            elif first.page_type == "divider" and standalone_special:
                pdf_divider_renderer.render_divider_page(
                    out_doc,
                    first.divider_content or "",
                    first.divider_style or "simple",
                    paper_w_pt,
                    paper_h_pt,
                )
                out_page = out_doc[-1]
            else:
                effective_nup = (
                    int(request.nup_default)
                    if booklet_enabled
                    else (
                        1
                        if first.nup_disabled
                        else int(first.nup_override or request.nup_default)
                    )
                )
                cache_key = _layout_cache_key(
                    effective_nup,
                    content_margins,
                    gap_pt,
                    page_order,
                    booklet_enabled,
                )
                layout = layout_cache.get(cache_key)
                if layout is None:
                    layout = _build_page_layout(
                        effective_nup,
                        paper_w_pt,
                        paper_h_pt,
                        content_margins,
                        gap_pt,
                        page_order=page_order,
                        booklet=booklet_enabled,
                    )
                    layout_cache[cache_key] = layout

                out_page = out_doc.new_page(
                    width=paper_w_pt,
                    height=paper_h_pt,
                )
                for slot_idx, page_info in enumerate(group):
                    if slot_idx >= len(layout.cell_rects):
                        break
                    if page_info.page_type == "blank":
                        continue
                    cell_rect = layout.cell_rects[slot_idx]
                    if page_info.page_type == "divider":
                        _render_divider_in_cell(
                            out_page,
                            page_info,
                            cell_rect,
                            paper_w_pt,
                            paper_h_pt,
                        )
                        continue
                    _render_source_page(
                        out_page,
                        sources,
                        page_info,
                        cell_rect,
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
                paper_margins=paper_margins,
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
        src_docs = [
            fitz.open(stream=data, filetype="pdf")
            for data in file_bytes_list
        ]
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
