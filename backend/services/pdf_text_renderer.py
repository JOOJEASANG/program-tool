"""Render Korean-capable PDF text overlays without runtime monkeypatching."""
from __future__ import annotations

from types import SimpleNamespace

import fitz

from services import pdf_ops

CJK_FONT_NAME = "korea"
MAX_OVERLAY_TEXT_LENGTH = 500


def _safe_text(value) -> str:
    return str(value or "")[:MAX_OVERLAY_TEXT_LENGTH]


def apply_watermark(page: fitz.Page, settings) -> None:
    if not settings.enabled or not settings.text:
        return
    text = _safe_text(settings.text)
    if not text:
        return

    color = pdf_ops._hex_to_rgb(settings.color, (0.8, 0.8, 0.8))
    width, height = page.rect.width, page.rect.height
    fontsize = 48
    diagonal = (width ** 2 + height ** 2) ** 0.5
    repeat_step = max(fontsize * 3, fontsize * (len(text) * 0.6 + 2))
    count = min(40, int(diagonal / repeat_step) + 4)

    shape = page.new_shape()
    for row in range(-count, count):
        for column in range(-count, count):
            center_x = width / 2 + row * repeat_step
            center_y = height / 2 + column * repeat_step
            if -100 < center_x < width + 100 and -100 < center_y < height + 100:
                anchor = fitz.Point(center_x, center_y)
                shape.insert_text(
                    anchor,
                    text,
                    fontsize=fontsize,
                    fontname=CJK_FONT_NAME,
                    color=color,
                    fill=color,
                    morph=(anchor, fitz.Matrix(settings.angle)),
                    fill_opacity=settings.opacity,
                    stroke_opacity=settings.opacity,
                )
    shape.commit(overlay=True)


def apply_header_footer(
    page: fitz.Page,
    settings,
    page_width: float,
    page_height: float,
    output_page_num: int = 1,
    total_pages: int = 1,
    facing_pages: bool = False,
) -> None:
    if not settings.enabled:
        return

    is_odd = output_page_num % 2 == 1
    apply_to = getattr(settings, "apply_to", "all")
    if apply_to == "odd" and not is_odd:
        return
    if apply_to == "even" and is_odd:
        return

    fields = pdf_ops._resolve_hf_fields(settings, output_page_num, total_pages)
    if facing_pages and not is_odd:
        fields = SimpleNamespace(
            header_left=fields.header_right,
            header_center=fields.header_center,
            header_right=fields.header_left,
            footer_left=fields.footer_right,
            footer_center=fields.footer_center,
            footer_right=fields.footer_left,
        )

    color = pdf_ops._hex_to_rgb(settings.color, (0.2, 0.2, 0.2))
    fontsize = max(5.0, min(72.0, float(settings.font_size)))
    margin_mm = getattr(settings, "margin_mm", None)
    if margin_mm is not None:
        header_margin = pdf_ops._mm_to_pt_safe(margin_mm, 5.0)
        footer_margin = header_margin
    else:
        header_margin = pdf_ops._mm_to_pt_safe(
            getattr(settings, "header_margin_mm", 8.0), 8.0
        )
        footer_margin = pdf_ops._mm_to_pt_safe(
            getattr(settings, "footer_margin_mm", 8.0), 8.0
        )

    side_margin = header_margin
    left_rect = fitz.Rect(side_margin, 0, page_width * 0.36, page_height)
    center_rect = fitz.Rect(page_width * 0.25, 0, page_width * 0.75, page_height)
    right_rect = fitz.Rect(page_width * 0.64, 0, page_width - side_margin, page_height)

    def insert(text, base_rect, y, align):
        resolved = _safe_text(
            pdf_ops._hf_substitute(text, output_page_num, total_pages)
        )
        if not resolved:
            return
        rect = fitz.Rect(base_rect.x0, y, base_rect.x1, y + fontsize * 1.8)
        page.insert_textbox(
            rect,
            resolved,
            fontsize=fontsize,
            fontname=CJK_FONT_NAME,
            color=color,
            align=align,
            overlay=True,
        )

    header_y = header_margin
    footer_y = max(0, page_height - footer_margin - fontsize * 1.6)
    insert(fields.header_left, left_rect, header_y, fitz.TEXT_ALIGN_LEFT)
    insert(fields.header_center, center_rect, header_y, fitz.TEXT_ALIGN_CENTER)
    insert(fields.header_right, right_rect, header_y, fitz.TEXT_ALIGN_RIGHT)
    insert(fields.footer_left, left_rect, footer_y, fitz.TEXT_ALIGN_LEFT)
    insert(fields.footer_center, center_rect, footer_y, fitz.TEXT_ALIGN_CENTER)
    insert(fields.footer_right, right_rect, footer_y, fitz.TEXT_ALIGN_RIGHT)


def _page_number_applies(settings, output_idx: int) -> bool:
    if not settings.enabled:
        return False
    if settings.exclude_first and output_idx == 0:
        return False
    is_odd = output_idx % 2 == 0
    apply_to = getattr(settings, "apply_to", "all")
    return (
        apply_to == "all"
        or (apply_to == "odd" and is_odd)
        or (apply_to == "even" and not is_odd)
    )


def page_number_value(settings, output_idx: int, total_pages: int) -> tuple[int, int]:
    """Return visible number and visible total, including cover exclusion."""
    offset = 1 if settings.exclude_first else 0
    visible = output_idx + settings.start - offset
    visible_total = max(0, total_pages - offset) + settings.start - 1
    return visible, visible_total


def apply_page_numbers(
    page: fitz.Page,
    settings,
    output_idx: int,
    total_pages: int,
    page_width: float,
    page_height: float,
    facing_pages: bool = False,
    paper_margins: tuple[float, float, float, float] | None = None,
) -> None:
    if not _page_number_applies(settings, output_idx):
        return

    page_number = output_idx + 1
    is_odd = page_number % 2 == 1
    number, number_total = page_number_value(settings, output_idx, total_pages)
    if settings.format == "1":
        text = str(number)
    elif settings.format == "1/N":
        text = f"{number}/{number_total}"
    elif settings.format == "-1-":
        text = f"- {number} -"
    else:
        text = f"- {number}/{number_total} -"

    color = pdf_ops._hex_to_rgb(settings.color, (0.2, 0.2, 0.2))
    fontsize = max(5.0, min(72.0, float(settings.font_size)))
    position = settings.position
    if facing_pages and not is_odd:
        if "left" in position:
            position = position.replace("left", "right")
        elif "right" in position:
            position = position.replace("right", "left")

    margin_mm = getattr(settings, "margin_mm", None)
    extra = (
        pdf_ops._mm_to_pt_safe(margin_mm, 5.0)
        if margin_mm is not None
        else pdf_ops.PN_MARGIN_PT
    )
    if paper_margins is None:
        left_anchor = right_anchor = top_anchor = bottom_anchor = extra
    else:
        left, right, top, bottom = paper_margins
        left_anchor = max(left, extra)
        right_anchor = max(right, extra)
        top_anchor = max(top, extra)
        bottom_anchor = max(bottom, extra)

    y = (
        page_height - bottom_anchor - fontsize * 1.6
        if "bottom" in position
        else top_anchor
    )

    if "center" in position:
        rect = fitz.Rect(
            page_width * 0.25, y, page_width * 0.75, y + fontsize * 1.8
        )
        align = fitz.TEXT_ALIGN_CENTER
    elif "right" in position:
        rect = fitz.Rect(
            page_width * 0.55,
            y,
            page_width - right_anchor,
            y + fontsize * 1.8,
        )
        align = fitz.TEXT_ALIGN_RIGHT
    else:
        rect = fitz.Rect(
            left_anchor,
            y,
            page_width * 0.45,
            y + fontsize * 1.8,
        )
        align = fitz.TEXT_ALIGN_LEFT

    page.insert_textbox(
        rect,
        text,
        fontsize=fontsize,
        fontname=CJK_FONT_NAME,
        color=color,
        align=align,
        overlay=True,
    )
