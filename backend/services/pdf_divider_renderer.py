"""Render divider pages with the same fields used by the browser editor."""
from __future__ import annotations

import re

import fitz

from services import pdf_ops


CJK_FONT_NAME = "korea"
MAX_EXTRA_TEXTS = 30
MAX_TEXT_LENGTH = 500
EXTRA_TEXT_MAX_WIDTH_RATIO = 0.88
ITALIC_SHEAR = -0.20
MAX_SERVICE_IMAGE_BYTES = 15 * 1024 * 1024
SERVICE_IMAGE_PATH_RE = re.compile(
    r"^cover_templates/([A-Za-z0-9_-]{1,160})/[A-Za-z0-9._-]{1,240}$"
)


def _number(value, fallback: float, minimum: float, maximum: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = fallback
    return max(minimum, min(maximum, number))


def _text(value) -> str:
    return str(value or "")[:MAX_TEXT_LENGTH]


def _color(value, fallback=(0.0, 0.0, 0.0)):
    return pdf_ops._hex_to_rgb(str(value or ""), fallback)


def _alignment_for_x(x_pct: float) -> int:
    if x_pct <= 20:
        return fitz.TEXT_ALIGN_LEFT
    if x_pct >= 80:
        return fitz.TEXT_ALIGN_RIGHT
    return fitz.TEXT_ALIGN_CENTER


def _text_rect(page_w: float, x_pct: float, y0: float, y1: float, pad: float):
    align = _alignment_for_x(x_pct)
    if align == fitz.TEXT_ALIGN_LEFT:
        return fitz.Rect(max(pad, page_w * x_pct / 100), y0, page_w - pad, y1), align
    if align == fitz.TEXT_ALIGN_RIGHT:
        return fitz.Rect(pad, y0, min(page_w - pad, page_w * x_pct / 100), y1), align
    return fitz.Rect(pad, y0, page_w - pad, y1), align


def _insert_textbox(page: fitz.Page, text: str, x_pct: float, y: float, size: float, color, opacity: float = 1.0):
    if not text:
        return
    rect, align = _text_rect(page.rect.width, x_pct, max(0, y - size), min(page.rect.height, y + size), 40)
    page.insert_textbox(rect, text, fontsize=size, fontname=CJK_FONT_NAME, color=color, align=align, fill_opacity=opacity, overlay=True)


def _measure_text(text: str, size: float) -> float:
    try:
        return fitz.Font(CJK_FONT_NAME).text_length(text, fontsize=size)
    except Exception:
        return len(text) * size * 0.6


def fit_extra_text(text: str, size: float, page_width: float) -> tuple[float, float]:
    max_width = page_width * EXTRA_TEXT_MAX_WIDTH_RATIO
    text_width = _measure_text(text, size)
    if text_width > max_width and text_width > 0:
        size = max(1.0, size * max_width / text_width)
        text_width = _measure_text(text, size)
    return size, text_width


def _text_morph(anchor: fitz.Point, italic: bool, rotation: float):
    if not italic and not rotation:
        return None
    matrix = fitz.Matrix(1, 0, ITALIC_SHEAR if italic else 0, 1, 0, 0)
    if rotation:
        matrix.prerotate(rotation)
    return anchor, matrix


def _draw_extra_text(page: fitz.Page, item: dict):
    text = _text(item.get("text"))
    if not text or item.get("hidden") is True:
        return
    width, height = page.rect.width, page.rect.height
    x_pct = _number(item.get("x"), 50, 0, 100)
    y_pct = _number(item.get("y"), 70, 0, 100)
    size = _number(item.get("size"), 18, 6, 96)
    opacity = _number(item.get("opacity"), 1, 0.05, 1)
    rotation = _number(item.get("rotation"), 0, -180, 180)
    italic = bool(item.get("italic"))
    align_name = str(item.get("align") or "center").lower()
    color = _color(item.get("color"), (0.0, 0.0, 0.0))
    weight = _number(item.get("weight"), 400, 100, 900)
    size, text_width = fit_extra_text(text, size, width)
    anchor = fitz.Point(width * x_pct / 100, height * y_pct / 100)
    start_x = anchor.x
    if align_name == "center":
        start_x -= text_width / 2
    elif align_name == "right":
        start_x -= text_width
    baseline = anchor.y + size * 0.34
    render_mode = 2 if weight >= 700 else 0
    page.insert_text(
        fitz.Point(start_x, baseline),
        text,
        fontsize=size,
        fontname=CJK_FONT_NAME,
        color=color,
        fill=color,
        fill_opacity=opacity,
        stroke_opacity=opacity,
        render_mode=render_mode,
        border_width=0.25 if render_mode else 1,
        morph=_text_morph(anchor, italic, rotation),
        overlay=True,
    )


def _service_image_bytes(content: dict) -> bytes | None:
    """Load only a currently public PDF-divider service image from Firebase.

    The client may submit metadata, but Admin SDK access is allowed only after
    the Firestore document proves that the exact Storage path is a public
    service-image-v2 assigned to the PDF divider surface.
    """
    image_id = str(content.get("serviceImageId") or "").strip()
    image_path = str(content.get("serviceImagePath") or "").strip()
    if not image_id or not image_path:
        return None
    match = SERVICE_IMAGE_PATH_RE.fullmatch(image_path)
    if match is None or match.group(1) != image_id:
        return None
    try:
        from firebase_admin import firestore as fa_firestore
        from firebase_admin import storage as fa_storage

        snapshot = fa_firestore.client().collection("cover_templates").document(image_id).get()
        if not snapshot.exists:
            return None
        data = snapshot.to_dict() or {}
        targets = data.get("targets") if isinstance(data.get("targets"), list) else []
        if (
            data.get("kind") != "service-image-v2"
            or data.get("isPublic") is not True
            or "pdf-divider" not in targets
            or str(data.get("imagePath") or "") != image_path
        ):
            return None
        blob = fa_storage.bucket().blob(image_path)
        blob.reload()
        size = int(blob.size or 0)
        if size <= 0 or size > MAX_SERVICE_IMAGE_BYTES:
            return None
        return blob.download_as_bytes()
    except Exception:
        return None


def render_divider_page(out_doc: fitz.Document, content_raw: str, style: str, paper_w_pt: float, paper_h_pt: float):
    content = pdf_ops._parse_divider_content(content_raw)
    title = _text(content.get("title"))
    subtitle = _text(content.get("subtitle"))
    note = _text(content.get("note"))
    resolved_style = str(content.get("style") or style or "simple")
    no_bg = content.get("noBg") is not False
    fg = _color(content.get("fg"), (0.0, 0.0, 0.0))
    bg = _color(content.get("bg"), (1.0, 1.0, 1.0))
    offset = _number(content.get("textVOffset"), 0, -40, 40)
    title_y_pct = _number(content.get("titleY"), 45, 5, 95) + offset
    subtitle_y_pct = _number(content.get("subtitleY"), 55, 5, 95) + offset
    note_y_pct = _number(content.get("noteY"), 88, 5, 95) + offset
    title_x_pct = _number(content.get("titleX"), 50, 5, 95)
    subtitle_x_pct = _number(content.get("subtitleX"), 50, 5, 95)
    note_x_pct = _number(content.get("noteX"), 50, 5, 95)
    title_y = paper_h_pt * _number(title_y_pct, 45, 0, 100) / 100
    subtitle_y = paper_h_pt * _number(subtitle_y_pct, 55, 0, 100) / 100
    note_y = paper_h_pt * _number(note_y_pct, 88, 0, 100) / 100
    page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)

    service_image = _service_image_bytes(content)
    if service_image:
        try:
            page.insert_image(page.rect, stream=service_image, keep_proportion=False, overlay=True)
        except Exception:
            service_image = None
    if service_image is None and not no_bg:
        page.draw_rect(page.rect, color=None, fill=bg, overlay=True)

    has_visual_background = service_image is not None or not no_bg
    if has_visual_background and resolved_style == "band":
        page.draw_rect(
            fitz.Rect(0, paper_h_pt * 0.34, paper_w_pt, paper_h_pt * 0.66),
            color=None,
            fill=fg,
            fill_opacity=0.16,
            overlay=True,
        )
    elif resolved_style == "lines":
        shape = page.new_shape()
        shape.draw_line(
            fitz.Point(paper_w_pt * 0.14, paper_h_pt * 0.38),
            fitz.Point(paper_w_pt * 0.86, paper_h_pt * 0.38),
        )
        shape.draw_line(
            fitz.Point(paper_w_pt * 0.14, paper_h_pt * 0.64),
            fitz.Point(paper_w_pt * 0.86, paper_h_pt * 0.64),
        )
        shape.finish(
            color=fg,
            width=max(1, paper_w_pt * 0.002),
            stroke_opacity=0.28,
        )
        shape.commit(overlay=True)
    _insert_textbox(page, title, title_x_pct, title_y, 42, fg, 1)
    _insert_textbox(page, subtitle, subtitle_x_pct, subtitle_y, 24, fg, 0.82)
    _insert_textbox(page, note, note_x_pct, note_y, 15, fg, 0.68)
    extra_texts = content.get("extraTexts")
    if isinstance(extra_texts, list):
        for item in extra_texts[:MAX_EXTRA_TEXTS]:
            if isinstance(item, dict):
                _draw_extra_text(page, item)
