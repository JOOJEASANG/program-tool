"""Align header/footer horizontal anchors with independent paper margins."""
from __future__ import annotations

from contextvars import ContextVar
from types import SimpleNamespace

import fitz

from services import pdf_engine, pdf_ops, pdf_text_renderer

_CURRENT_REQUEST: ContextVar[object | None] = ContextVar(
    "pdf_overlay_margin_request",
    default=None,
)
_ORIGINAL_BUILD = pdf_engine.build_pdf_document
_ORIGINAL_HEADER_FOOTER = pdf_text_renderer.apply_header_footer


def _paper_side_anchors(
    request,
    output_page_num: int,
    overlay_margin_pt: float,
) -> tuple[float, float]:
    """Return left/right overlay anchors after facing-page margin swapping."""
    left, right, _top, _bottom = pdf_engine._base_layout_margins(
        request,
        max(0, int(output_page_num) - 1),
    )
    return max(left, overlay_margin_pt), max(right, overlay_margin_pt)


def _text_rects(
    page_width: float,
    left_anchor: float,
    right_anchor: float,
) -> tuple[fitz.Rect, fitz.Rect, fitz.Rect]:
    usable_left = max(0.0, min(page_width, left_anchor))
    usable_right = max(usable_left + 1.0, min(page_width, page_width - right_anchor))
    center = (usable_left + usable_right) / 2
    return (
        fitz.Rect(usable_left, 0, center, 1),
        fitz.Rect(usable_left, 0, usable_right, 1),
        fitz.Rect(center, 0, usable_right, 1),
    )


def _apply_header_footer_with_paper_margins(
    page: fitz.Page,
    settings,
    page_width: float,
    page_height: float,
    output_page_num: int = 1,
    total_pages: int = 1,
    facing_pages: bool = False,
) -> None:
    request = _CURRENT_REQUEST.get()
    if request is None:
        return _ORIGINAL_HEADER_FOOTER(
            page,
            settings,
            page_width,
            page_height,
            output_page_num,
            total_pages,
            facing_pages,
        )
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
            getattr(settings, "header_margin_mm", 8.0),
            8.0,
        )
        footer_margin = pdf_ops._mm_to_pt_safe(
            getattr(settings, "footer_margin_mm", 8.0),
            8.0,
        )

    header_left, header_right = _paper_side_anchors(
        request,
        output_page_num,
        header_margin,
    )
    footer_left, footer_right = _paper_side_anchors(
        request,
        output_page_num,
        footer_margin,
    )
    header_rects = _text_rects(page_width, header_left, header_right)
    footer_rects = _text_rects(page_width, footer_left, footer_right)

    def insert(text, base_rect, y, align):
        resolved = pdf_text_renderer._safe_text(
            pdf_ops._hf_substitute(text, output_page_num, total_pages)
        )
        if not resolved:
            return
        rect = fitz.Rect(base_rect.x0, y, base_rect.x1, y + fontsize * 1.8)
        page.insert_textbox(
            rect,
            resolved,
            fontsize=fontsize,
            fontname=pdf_text_renderer.CJK_FONT_NAME,
            color=color,
            align=align,
            overlay=True,
        )

    header_y = header_margin
    footer_y = max(0, page_height - footer_margin - fontsize * 1.6)
    insert(fields.header_left, header_rects[0], header_y, fitz.TEXT_ALIGN_LEFT)
    insert(fields.header_center, header_rects[1], header_y, fitz.TEXT_ALIGN_CENTER)
    insert(fields.header_right, header_rects[2], header_y, fitz.TEXT_ALIGN_RIGHT)
    insert(fields.footer_left, footer_rects[0], footer_y, fitz.TEXT_ALIGN_LEFT)
    insert(fields.footer_center, footer_rects[1], footer_y, fitz.TEXT_ALIGN_CENTER)
    insert(fields.footer_right, footer_rects[2], footer_y, fitz.TEXT_ALIGN_RIGHT)


def _build_pdf_document_with_overlay_context(src_docs, request):
    token = _CURRENT_REQUEST.set(request)
    try:
        return _ORIGINAL_BUILD(src_docs, request)
    finally:
        _CURRENT_REQUEST.reset(token)


if not getattr(pdf_engine, "_overlay_margin_patch_v1", False):
    pdf_engine.build_pdf_document = _build_pdf_document_with_overlay_context
    pdf_text_renderer.apply_header_footer = _apply_header_footer_with_paper_margins
    pdf_engine._overlay_margin_patch_v1 = True
