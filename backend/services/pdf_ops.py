"""
PDF processing with PyMuPDF.
All operations preserve PDF vector/text quality — no rasterization of source pages.
"""
import io
import math
from typing import Optional
import fitz  # PyMuPDF

from models.schemas import (
    PageInfo, PdfProcessRequest, WatermarkSettings,
    HeaderFooterSettings, PageNumberSettings, PaperSize
)

MM_TO_PT = 72 / 25.4
MARGIN_PT = 10  # margin around N-up grid
CELL_GAP_PT = 6  # gap between cells in N-up grid

NUP_LAYOUT: dict[int, tuple[int, int]] = {
    1: (1, 1),
    2: (1, 2),
    4: (2, 2),
    6: (2, 3),
    9: (3, 3),
}

HF_MARGIN_PT = 8  # distance from edge to HF text
PN_MARGIN_PT = 8


def _hex_to_rgb(hex_color: str) -> tuple[float, float, float]:
    hex_color = hex_color.lstrip("#")
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    return r / 255, g / 255, b / 255


def _group_by_nup(pages: list[PageInfo], default_nup: int) -> list[list[PageInfo]]:
    groups: list[list[PageInfo]] = []
    current: list[PageInfo] = []
    current_nup: Optional[int] = None

    for p in pages:
        if p.excluded:
            continue
        effective_nup = 1 if p.nup_disabled else (p.nup_override or default_nup)

        if p.group_break and current:
            groups.append(current)
            current = []
            current_nup = None

        if p.nup_disabled:
            if current:
                groups.append(current)
            groups.append([p])
            current = []
            current_nup = None
            continue

        if effective_nup != current_nup:
            if current:
                groups.append(current)
            current = [p]
            current_nup = effective_nup
        else:
            current.append(p)
            if len(current) >= effective_nup:
                groups.append(current)
                current = []
                current_nup = None

    if current:
        groups.append(current)

    return groups


def _calc_fit_rect(cell_rect: fitz.Rect, src_w: float, src_h: float, rotation: int) -> fitz.Rect:
    if rotation in (90, 270):
        src_w, src_h = src_h, src_w

    cell_w = cell_rect.width
    cell_h = cell_rect.height
    scale = min(cell_w / src_w, cell_h / src_h)
    fitted_w = src_w * scale
    fitted_h = src_h * scale
    ox = cell_rect.x0 + (cell_w - fitted_w) / 2
    oy = cell_rect.y0 + (cell_h - fitted_h) / 2
    return fitz.Rect(ox, oy, ox + fitted_w, oy + fitted_h)


def _parse_divider_content(raw: Optional[str]) -> dict:
    """Parse JSON-encoded divider content from frontend, or treat as plain title string."""
    if not raw:
        return {}
    try:
        import json
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {"title": raw}


def _render_divider_page(out_doc: fitz.Document, content_raw: str, style: str,
                          paper_w_pt: float, paper_h_pt: float):
    content = _parse_divider_content(content_raw)
    title = content.get("title", "")
    subtitle = content.get("subtitle", "")
    bg_hex = content.get("bg", "#1a365d")
    fg_hex = content.get("fg", "#ffffff")
    resolved_style = content.get("style", style or "simple")

    try:
        bg = _hex_to_rgb(bg_hex)
    except Exception:
        bg = (0.1, 0.22, 0.43)
    try:
        fg = _hex_to_rgb(fg_hex)
    except Exception:
        fg = (1.0, 1.0, 1.0)

    page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)

    # Background fill
    shape = page.new_shape()
    shape.draw_rect(fitz.Rect(0, 0, paper_w_pt, paper_h_pt))
    shape.finish(fill=bg, color=None)
    shape.commit()

    cx = paper_w_pt / 2
    cy = paper_h_pt / 2
    title_y = cy + (-paper_h_pt * 0.06 if subtitle else 0)

    if resolved_style == "band":
        shape = page.new_shape()
        darker = tuple(max(0.0, c - 0.16) for c in bg)
        shape.draw_rect(fitz.Rect(0, 0, paper_w_pt * 0.07, paper_h_pt))
        shape.draw_rect(fitz.Rect(paper_w_pt * 0.93, 0, paper_w_pt, paper_h_pt))
        shape.finish(fill=darker, color=None)
        shape.commit()

    elif resolved_style == "lines":
        shape = page.new_shape()
        shape.draw_line(fitz.Point(40, title_y - paper_h_pt * 0.09), fitz.Point(paper_w_pt - 40, title_y - paper_h_pt * 0.09))
        shape.draw_line(fitz.Point(40, title_y + paper_h_pt * 0.09), fitz.Point(paper_w_pt - 40, title_y + paper_h_pt * 0.09))
        shape.finish(color=fg, width=1.5)
        shape.commit()

    if title:
        page.insert_text(
            fitz.Point(cx, title_y),
            title,
            fontsize=28,
            fontname="helv",
            color=fg,
            render_mode=0,
        )

    if subtitle:
        page.insert_text(
            fitz.Point(cx, cy + paper_h_pt * 0.06),
            subtitle,
            fontsize=18,
            fontname="helv",
            color=(*fg, 0.75) if len(fg) == 3 else fg,
            render_mode=0,
        )


def _apply_watermark(page: fitz.Page, settings: WatermarkSettings):
    if not settings.enabled or not settings.text:
        return
    color = _hex_to_rgb(settings.color)
    w, h = page.rect.width, page.rect.height
    text = settings.text
    fontsize = 48
    angle_rad = math.radians(settings.angle)
    diagonal = math.sqrt(w ** 2 + h ** 2)
    repeat_step = fontsize * (len(text) * 0.6 + 2)
    n = int(diagonal / repeat_step) + 4

    shape = page.new_shape()
    for i in range(-n, n):
        for j in range(-n, n):
            cx = w / 2 + i * repeat_step * math.cos(angle_rad) - j * repeat_step * math.sin(angle_rad)
            cy = h / 2 + i * repeat_step * math.sin(angle_rad) + j * repeat_step * math.cos(angle_rad)
            if -100 < cx < w + 100 and -100 < cy < h + 100:
                shape.insert_text(
                    fitz.Point(cx, cy),
                    text,
                    fontsize=fontsize,
                    color=(*color, settings.opacity),
                    morph=(fitz.Point(cx, cy), fitz.Matrix(settings.angle)),
                )
    shape.commit()


def _apply_header_footer(page: fitz.Page, settings: HeaderFooterSettings, page_width: float, page_height: float):
    if not settings.enabled:
        return
    color = _hex_to_rgb(settings.color)
    fs = settings.font_size
    left_x = HF_MARGIN_PT
    center_x = page_width / 2
    right_x = page_width - HF_MARGIN_PT

    def insert(text: str, x: float, y: float, align: int):
        if not text:
            return
        page.insert_text(
            fitz.Point(x, y),
            text,
            fontsize=fs,
            fontname="helv",
            color=color,
            render_mode=0,
        )

    header_y = HF_MARGIN_PT + fs
    footer_y = page_height - HF_MARGIN_PT

    insert(settings.header_left, left_x, header_y, 0)
    insert(settings.header_center, center_x, header_y, 1)
    insert(settings.header_right, right_x, header_y, 2)
    insert(settings.footer_left, left_x, footer_y, 0)
    insert(settings.footer_center, center_x, footer_y, 1)
    insert(settings.footer_right, right_x, footer_y, 2)


def _apply_page_numbers(page: fitz.Page, settings: PageNumberSettings,
                        output_idx: int, total_pages: int, page_width: float, page_height: float):
    if not settings.enabled:
        return
    if settings.exclude_first and output_idx == 0:
        return

    num = output_idx + settings.start
    if settings.format == "1":
        text = str(num)
    elif settings.format == "1/N":
        text = f"{num}/{total_pages}"
    elif settings.format == "-1-":
        text = f"- {num} -"
    else:
        text = f"- {num}/{total_pages} -"

    color = _hex_to_rgb(settings.color)
    pos = settings.position
    margin = PN_MARGIN_PT + settings.font_size

    if "bottom" in pos:
        y = page_height - PN_MARGIN_PT
    else:
        y = margin

    if "center" in pos:
        x = page_width / 2
    elif "right" in pos:
        x = page_width - PN_MARGIN_PT
    else:
        x = PN_MARGIN_PT

    page.insert_text(
        fitz.Point(x, y),
        text,
        fontsize=settings.font_size,
        fontname="helv",
        color=color,
        render_mode=0,
    )


def process_pdf(
    file_bytes_list: list[bytes],
    request: PdfProcessRequest,
) -> bytes:
    """
    Build output PDF from uploaded file bytes + request settings.
    file_bytes_list[i] corresponds to pages with file_index == i.
    """
    src_docs = [fitz.open(stream=b, filetype="pdf") for b in file_bytes_list]

    paper_w_pt = request.paper.width_mm * MM_TO_PT
    paper_h_pt = request.paper.height_mm * MM_TO_PT

    active_pages = [p for p in request.pages if not p.excluded]
    groups = _group_by_nup(active_pages, request.nup_default)

    out_doc = fitz.open()
    output_page_idx = 0
    total_output_pages = sum(1 for g in groups for _ in [g])  # will recalculate below

    # First pass: count output pages
    total_output_pages = len(groups)

    for group in groups:
        first = group[0]

        if first.page_type == "divider":
            _render_divider_page(
                out_doc, first.divider_content or "",
                first.divider_style or "simple",
                paper_w_pt, paper_h_pt
            )
            out_page = out_doc[-1]
            _apply_watermark(out_page, request.watermark)
            _apply_header_footer(out_page, request.header_footer, paper_w_pt, paper_h_pt)
            _apply_page_numbers(out_page, request.page_numbers, output_page_idx, total_output_pages, paper_w_pt, paper_h_pt)
            output_page_idx += 1
            continue

        effective_nup = 1 if first.nup_disabled else (first.nup_override or request.nup_default)
        cols, rows = NUP_LAYOUT.get(effective_nup, (1, 1))

        out_page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)

        usable_w = paper_w_pt - 2 * MARGIN_PT - (cols - 1) * CELL_GAP_PT
        usable_h = paper_h_pt - 2 * MARGIN_PT - (rows - 1) * CELL_GAP_PT
        cell_w = usable_w / cols
        cell_h = usable_h / rows

        for slot_idx, page_info in enumerate(group):
            col = slot_idx % cols
            row = slot_idx // cols
            cell_x0 = MARGIN_PT + col * (cell_w + CELL_GAP_PT)
            cell_y0 = MARGIN_PT + row * (cell_h + CELL_GAP_PT)
            cell_rect = fitz.Rect(cell_x0, cell_y0, cell_x0 + cell_w, cell_y0 + cell_h)

            src_doc = src_docs[page_info.file_index]
            src_page = src_doc[page_info.page_index]
            src_rect = src_page.rect

            fit_rect = _calc_fit_rect(cell_rect, src_rect.width, src_rect.height, page_info.rotation)

            out_page.show_pdf_page(
                fit_rect,
                src_doc,
                page_info.page_index,
                rotate=page_info.rotation,
                keep_proportion=True,
            )

            if request.add_border:
                shape = out_page.new_shape()
                shape.draw_rect(fit_rect)
                shape.finish(color=(0.6, 0.6, 0.6), width=0.5)
                shape.commit()

        _apply_watermark(out_page, request.watermark)
        _apply_header_footer(out_page, request.header_footer, paper_w_pt, paper_h_pt)
        _apply_page_numbers(out_page, request.page_numbers, output_page_idx, total_output_pages, paper_w_pt, paper_h_pt)
        output_page_idx += 1

    for src_doc in src_docs:
        src_doc.close()

    buf = io.BytesIO()
    out_doc.save(buf, garbage=4, deflate=True)
    out_doc.close()
    return buf.getvalue()
