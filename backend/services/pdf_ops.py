"""
PDF processing with PyMuPDF.
All operations preserve PDF vector/text quality — no rasterization of source pages.
"""
import io
import math
import re
from datetime import date
from typing import Optional
import fitz  # PyMuPDF

from models.schemas import (
    PageInfo, PdfProcessRequest, WatermarkSettings,
    HeaderFooterSettings, PageNumberSettings, PaperSize
)

MM_TO_PT = 72 / 25.4
MARGIN_PT = 10  # legacy fallback only
CELL_GAP_PT = 6  # legacy fallback only

NUP_LAYOUT: dict[int, tuple[int, int]] = {
    1: (1, 1),
    2: (1, 2),
    4: (2, 2),
    6: (2, 3),
    8: (2, 4),
    9: (3, 3),
}

HF_SIDE_MARGIN_PT = 8
PN_MARGIN_PT = 8


def _hex_to_rgb(hex_color: str, fallback: tuple[float, float, float] = (0, 0, 0)) -> tuple[float, float, float]:
    """Convert #rrggbb or #rgb to PyMuPDF RGB tuple. Invalid values fall back safely."""
    try:
        raw = (hex_color or "").strip().lstrip("#")
        if len(raw) == 3:
            raw = "".join(ch * 2 for ch in raw)
        if len(raw) != 6 or not re.fullmatch(r"[0-9a-fA-F]{6}", raw):
            return fallback
        r, g, b = int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16)
        return r / 255, g / 255, b / 255
    except Exception:
        return fallback


def _mm_to_pt_safe(value: float, fallback_mm: float = 8.0, min_mm: float = 0.0, max_mm: float = 50.0) -> float:
    try:
        mm = float(value)
    except Exception:
        mm = fallback_mm
    mm = min(max(mm, min_mm), max_mm)
    return mm * MM_TO_PT


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


def _render_blank_page(out_doc: fitz.Document, paper_w_pt: float, paper_h_pt: float):
    """Insert a truly blank white page."""
    out_doc.new_page(width=paper_w_pt, height=paper_h_pt)


def _render_divider_page(out_doc: fitz.Document, content_raw: str, style: str,
                          paper_w_pt: float, paper_h_pt: float):
    """Render divider page without custom background color."""
    content = _parse_divider_content(content_raw)
    title = content.get("title", "")
    subtitle = content.get("subtitle", "")
    note = content.get("note", "")
    fg = (0.067, 0.094, 0.153)
    resolved_style = content.get("style", style or "simple")
    title_y = paper_h_pt * _safe_float(content.get("titleY", 45), 45, 5, 95) / 100
    subtitle_y = paper_h_pt * _safe_float(content.get("subtitleY", 55), 55, 5, 95) / 100
    note_y = paper_h_pt * _safe_float(content.get("noteY", 88), 88, 5, 95) / 100
    page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)
    pad = 40
    if resolved_style in ("lines", "band"):
        shape = page.new_shape()
        shape.draw_line(fitz.Point(pad, title_y - paper_h_pt * 0.09), fitz.Point(paper_w_pt - pad, title_y - paper_h_pt * 0.09))
        shape.draw_line(fitz.Point(pad, title_y + paper_h_pt * 0.09), fitz.Point(paper_w_pt - pad, title_y + paper_h_pt * 0.09))
        shape.finish(color=fg, width=1.0)
        shape.commit()
    if title:
        page.insert_textbox(fitz.Rect(pad, title_y - 32, paper_w_pt - pad, title_y + 14), title, fontsize=28, fontname="helv", color=fg, align=fitz.TEXT_ALIGN_CENTER)
    if subtitle:
        page.insert_textbox(fitz.Rect(pad, subtitle_y - 24, paper_w_pt - pad, subtitle_y + 12), subtitle, fontsize=18, fontname="helv", color=fg, align=fitz.TEXT_ALIGN_CENTER)
    if note:
        page.insert_textbox(fitz.Rect(pad, note_y - 18, paper_w_pt - pad, note_y + 10), note, fontsize=11, fontname="helv", color=fg, align=fitz.TEXT_ALIGN_CENTER)


def _safe_float(value, fallback, min_value=0.0, max_value=100.0):
    try:
        n = float(value)
    except Exception:
        n = fallback
    return max(min_value, min(max_value, n))


def _apply_watermark(page: fitz.Page, settings: WatermarkSettings):
    if not settings.enabled or not settings.text:
        return
    color = _hex_to_rgb(settings.color, (0.8, 0.8, 0.8))
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


def _parse_page_ranges(spec: str, total_pages: int) -> set[int]:
    if not spec or not spec.strip():
        return set(range(1, total_pages + 1))
    pages: set[int] = set()
    for chunk in re.split(r"[,\s]+", spec.strip()):
        if not chunk:
            continue
        m = re.match(r"^(\d+)\s*-\s*(\d+)$", chunk)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            for p in range(min(a, b), max(a, b) + 1):
                if 1 <= p <= total_pages:
                    pages.add(p)
        else:
            try:
                p = int(chunk)
                if 1 <= p <= total_pages:
                    pages.add(p)
            except ValueError:
                pass
    return pages


def _resolve_hf_fields(settings: HeaderFooterSettings, page_num: int, total_pages: int):
    if settings.sections:
        for s in reversed(settings.sections):
            if page_num in _parse_page_ranges(s.ranges, total_pages):
                return s
    return settings


def _hf_substitute(text: str, page_num: int, total_pages: int) -> str:
    if not text:
        return text
    return (
        text.replace("{n}", str(page_num))
        .replace("{total}", str(total_pages))
        .replace("{date}", date.today().isoformat())
    )


def _apply_header_footer(
    page: fitz.Page, settings: HeaderFooterSettings,
    page_width: float, page_height: float,
    output_page_num: int = 1, total_pages: int = 1,
    facing_pages: bool = False,
):
    if not settings.enabled:
        return

    # apply_to check
    is_odd = output_page_num % 2 == 1
    apply_to = getattr(settings, "apply_to", "all")
    if apply_to == "odd" and not is_odd:
        return
    if apply_to == "even" and is_odd:
        return

    fields = _resolve_hf_fields(settings, output_page_num, total_pages)

    # Mirror left/right for facing pages on even pages
    if facing_pages and not is_odd:
        from types import SimpleNamespace
        fields = SimpleNamespace(
            header_left=fields.header_right,
            header_center=fields.header_center,
            header_right=fields.header_left,
            footer_left=fields.footer_right,
            footer_center=fields.footer_center,
            footer_right=fields.footer_left,
        )

    color = _hex_to_rgb(settings.color, (0.2, 0.2, 0.2))
    fs = settings.font_size

    margin_mm_val = getattr(settings, "margin_mm", None)
    if margin_mm_val is not None:
        header_margin = _mm_to_pt_safe(margin_mm_val, 5.0)
        footer_margin = header_margin
    else:
        header_margin = _mm_to_pt_safe(getattr(settings, "header_margin_mm", 8.0), 8.0)
        footer_margin = _mm_to_pt_safe(getattr(settings, "footer_margin_mm", 8.0), 8.0)

    side_margin = header_margin

    left_rect = fitz.Rect(side_margin, 0, page_width * 0.36, page_height)
    center_rect = fitz.Rect(page_width * 0.25, 0, page_width * 0.75, page_height)
    right_rect = fitz.Rect(page_width * 0.64, 0, page_width - side_margin, page_height)

    def insert(text: str, base_rect: fitz.Rect, y: float, align: int):
        text = _hf_substitute(text, output_page_num, total_pages)
        if not text:
            return
        rect = fitz.Rect(base_rect.x0, y, base_rect.x1, y + fs * 1.8)
        page.insert_textbox(rect, text, fontsize=fs, fontname="helv", color=color, align=align)

    header_y = header_margin
    footer_y = max(0, page_height - footer_margin - fs * 1.6)

    insert(fields.header_left, left_rect, header_y, fitz.TEXT_ALIGN_LEFT)
    insert(fields.header_center, center_rect, header_y, fitz.TEXT_ALIGN_CENTER)
    insert(fields.header_right, right_rect, header_y, fitz.TEXT_ALIGN_RIGHT)
    insert(fields.footer_left, left_rect, footer_y, fitz.TEXT_ALIGN_LEFT)
    insert(fields.footer_center, center_rect, footer_y, fitz.TEXT_ALIGN_CENTER)
    insert(fields.footer_right, right_rect, footer_y, fitz.TEXT_ALIGN_RIGHT)


def _apply_page_numbers(page: fitz.Page, settings: PageNumberSettings,
                        output_idx: int, total_pages: int, page_width: float, page_height: float,
                        facing_pages: bool = False):
    if not settings.enabled:
        return
    if settings.exclude_first and output_idx == 0:
        return

    # apply_to check
    page_1based = output_idx + 1
    is_odd = page_1based % 2 == 1
    apply_to = getattr(settings, "apply_to", "all")
    if apply_to == "odd" and not is_odd:
        return
    if apply_to == "even" and is_odd:
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

    color = _hex_to_rgb(settings.color, (0.2, 0.2, 0.2))
    fs = settings.font_size

    # Mirror position for facing pages on even pages
    pos = settings.position
    if facing_pages and not is_odd:
        if "left" in pos:
            pos = pos.replace("left", "right")
        elif "right" in pos:
            pos = pos.replace("right", "left")

    margin_mm_val = getattr(settings, "margin_mm", None)
    margin = _mm_to_pt_safe(margin_mm_val, 5.0) if margin_mm_val is not None else PN_MARGIN_PT

    if "bottom" in pos:
        y = page_height - margin - fs * 1.6
    else:
        y = margin

    if "center" in pos:
        rect = fitz.Rect(page_width * 0.25, y, page_width * 0.75, y + fs * 1.8)
        align = fitz.TEXT_ALIGN_CENTER
    elif "right" in pos:
        rect = fitz.Rect(page_width * 0.55, y, page_width - margin, y + fs * 1.8)
        align = fitz.TEXT_ALIGN_RIGHT
    else:
        rect = fitz.Rect(margin, y, page_width * 0.45, y + fs * 1.8)
        align = fitz.TEXT_ALIGN_LEFT

    page.insert_textbox(rect, text, fontsize=fs, fontname="helv", color=color, align=align)


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
    margin_h_pt = _mm_to_pt_safe(getattr(request, "margin_h_mm", 10.0), 10.0, 0.0, 80.0)
    margin_v_pt = _mm_to_pt_safe(getattr(request, "margin_v_mm", 10.0), 10.0, 0.0, 80.0)
    gap_pt = _mm_to_pt_safe(getattr(request, "gap_mm", 5.0), 5.0, 0.0, 50.0)

    active_pages = [p for p in request.pages if not p.excluded]
    groups = _group_by_nup(active_pages, request.nup_default)

    out_doc = fitz.open()
    output_page_idx = 0
    total_output_pages = len(groups)
    facing = getattr(request, "facing_pages", False)

    for group in groups:
        first = group[0]

        if first.page_type == "blank":
            _render_blank_page(out_doc, paper_w_pt, paper_h_pt)
            out_page = out_doc[-1]
            _apply_watermark(out_page, request.watermark)
            _apply_header_footer(out_page, request.header_footer, paper_w_pt, paper_h_pt, output_page_idx + 1, total_output_pages, facing)
            _apply_page_numbers(out_page, request.page_numbers, output_page_idx, total_output_pages, paper_w_pt, paper_h_pt, facing)
            output_page_idx += 1
            continue

        if first.page_type == "divider":
            _render_divider_page(
                out_doc, first.divider_content or "",
                first.divider_style or "simple",
                paper_w_pt, paper_h_pt
            )
            out_page = out_doc[-1]
            _apply_watermark(out_page, request.watermark)
            _apply_header_footer(out_page, request.header_footer, paper_w_pt, paper_h_pt, output_page_idx + 1, total_output_pages, facing)
            _apply_page_numbers(out_page, request.page_numbers, output_page_idx, total_output_pages, paper_w_pt, paper_h_pt, facing)
            output_page_idx += 1
            continue

        effective_nup = 1 if first.nup_disabled else (first.nup_override or request.nup_default)
        cols, rows = NUP_LAYOUT.get(effective_nup, (1, 1))
        if paper_w_pt > paper_h_pt and cols != rows:
            cols, rows = rows, cols

        out_page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)

        usable_w = paper_w_pt - 2 * margin_h_pt - (cols - 1) * gap_pt
        usable_h = paper_h_pt - 2 * margin_v_pt - (rows - 1) * gap_pt
        if usable_w <= 1 or usable_h <= 1:
            usable_w = paper_w_pt - 2 * MARGIN_PT - (cols - 1) * CELL_GAP_PT
            usable_h = paper_h_pt - 2 * MARGIN_PT - (rows - 1) * CELL_GAP_PT
            margin_h_use, margin_v_use, gap_use = MARGIN_PT, MARGIN_PT, CELL_GAP_PT
        else:
            margin_h_use, margin_v_use, gap_use = margin_h_pt, margin_v_pt, gap_pt
        cell_w = usable_w / cols
        cell_h = usable_h / rows

        for slot_idx, page_info in enumerate(group):
            col = slot_idx % cols
            row = slot_idx // cols
            cell_x0 = margin_h_use + col * (cell_w + gap_use)
            cell_y0 = margin_v_use + row * (cell_h + gap_use)
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
        _apply_header_footer(out_page, request.header_footer, paper_w_pt, paper_h_pt, output_page_idx + 1, total_output_pages, facing)
        _apply_page_numbers(out_page, request.page_numbers, output_page_idx, total_output_pages, paper_w_pt, paper_h_pt, facing)
        output_page_idx += 1

    for src_doc in src_docs:
        src_doc.close()

    buf = io.BytesIO()
    out_doc.save(buf, garbage=4, deflate=True)
    out_doc.close()
    return buf.getvalue()
