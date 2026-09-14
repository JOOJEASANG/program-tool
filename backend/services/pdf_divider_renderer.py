"""Render divider pages with the same fields used by the browser editor."""
from __future__ import annotations

import base64
import binascii
import re

import fitz

from services import pdf_ops


CJK_FONT_NAME = "korea"
MAX_EXTRA_TEXTS = 30
MAX_TEXT_LENGTH = 500
EXTRA_TEXT_MAX_WIDTH_RATIO = 0.88
ITALIC_SHEAR = -0.20
MAX_LOCAL_IMAGE_BYTES = 5 * 1024 * 1024
MAX_TOTAL_LOCAL_IMAGE_BYTES = 15 * 1024 * 1024
MAX_LOCAL_IMAGE_LAYERS = 6
LOCAL_IMAGE_DATA_RE = re.compile(
    r"^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$"
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
    rect, align = _text_rect(page.rect.width, x_pct, max(0, y - size * 1.15), min(page.rect.height, y + size * 1.15), 40)
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


def _decode_local_image_data_url(data_url) -> tuple[bytes, str] | None:
    """Decode one bounded inline JPG, PNG, or WebP image."""
    value = str(data_url or "").strip()
    if not value:
        return None
    if len(value) > (MAX_LOCAL_IMAGE_BYTES * 4 // 3) + 4096:
        return None
    match = LOCAL_IMAGE_DATA_RE.fullmatch(value)
    if match is None:
        return None
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError):
        return None
    if not raw or len(raw) > MAX_LOCAL_IMAGE_BYTES:
        return None
    return raw, match.group(1)


def _local_image_bytes(content: dict) -> bytes | None:
    decoded = _decode_local_image_data_url(content.get("localImageDataUrl"))
    return decoded[0] if decoded else None


def _local_image_layers(content: dict) -> list[dict]:
    layers = content.get("localImageLayers")
    if not isinstance(layers, list):
        return []
    result: list[dict] = []
    total_bytes = 0
    for item in layers[:MAX_LOCAL_IMAGE_LAYERS]:
        if not isinstance(item, dict):
            continue
        decoded = _decode_local_image_data_url(item.get("dataUrl"))
        if decoded is None:
            continue
        raw, image_type = decoded
        if total_bytes + len(raw) > MAX_TOTAL_LOCAL_IMAGE_BYTES:
            break
        total_bytes += len(raw)
        result.append({
            "raw": raw,
            "type": image_type,
            "x": _number(item.get("x"), 50, 0, 100),
            "y": _number(item.get("y"), 50, 0, 100),
            "scale": _number(item.get("scale"), 100, 10, 300),
            "fit": "cover" if str(item.get("fit") or "").lower() == "cover" else "contain",
        })
    return result


def _image_dimensions(raw: bytes, image_type: str) -> tuple[float, float] | None:
    try:
        image_doc = fitz.open(stream=raw, filetype=image_type)
        try:
            if image_doc.page_count < 1:
                return None
            rect = image_doc[0].rect
            if rect.width <= 0 or rect.height <= 0:
                return None
            return float(rect.width), float(rect.height)
        finally:
            image_doc.close()
    except Exception:
        return None


def _insert_image_layer(page: fitz.Page, layer: dict) -> bool:
    dimensions = _image_dimensions(layer["raw"], layer["type"])
    if dimensions is None:
        return False
    image_w, image_h = dimensions
    page_w, page_h = page.rect.width, page.rect.height
    if layer["fit"] == "cover":
        base_scale = max(page_w / image_w, page_h / image_h)
    else:
        base_scale = min(page_w / image_w, page_h / image_h)
    scale = base_scale * layer["scale"] / 100
    draw_w = image_w * scale
    draw_h = image_h * scale
    center_x = page.rect.x0 + page_w * layer["x"] / 100
    center_y = page.rect.y0 + page_h * layer["y"] / 100
    target = fitz.Rect(
        center_x - draw_w / 2,
        center_y - draw_h / 2,
        center_x + draw_w / 2,
        center_y + draw_h / 2,
    )
    try:
        page.insert_image(target, stream=layer["raw"], keep_proportion=True, overlay=True)
        return True
    except Exception:
        return False


def _draw_pattern(page: fitz.Page, content: dict):
    pattern = str(content.get("pattern") or "none").lower()
    if pattern not in {"dots", "grid", "diagonal"}:
        return
    color = _color(content.get("patternColor"), (1.0, 1.0, 1.0))
    opacity = _number(content.get("patternOpacity"), 0.10, 0.02, 0.30)
    width, height = page.rect.width, page.rect.height
    gap = max(22.0, min(width, height) / 14)
    shape = page.new_shape()
    if pattern == "dots":
        radius = max(0.8, gap * 0.045)
        y = gap / 2
        while y < height:
            x = gap / 2
            while x < width:
                shape.draw_circle(fitz.Point(x, y), radius)
                x += gap
            y += gap
        shape.finish(color=None, fill=color, fill_opacity=opacity)
    elif pattern == "grid":
        x = gap
        while x < width:
            shape.draw_line(fitz.Point(x, 0), fitz.Point(x, height))
            x += gap
        y = gap
        while y < height:
            shape.draw_line(fitz.Point(0, y), fitz.Point(width, y))
            y += gap
        shape.finish(color=color, width=max(0.5, width / 900), stroke_opacity=opacity)
    else:
        x = -height
        while x < width:
            shape.draw_line(fitz.Point(x, 0), fitz.Point(x + height, height))
            x += gap
        shape.finish(color=color, width=max(0.5, width / 900), stroke_opacity=opacity)
    shape.commit(overlay=True)


def _draw_frame_and_accent(page: fitz.Page, content: dict):
    width, height = page.rect.width, page.rect.height
    border_style = str(content.get("borderStyle") or "none").lower()
    border_color = _color(content.get("borderColor"), (1.0, 1.0, 1.0))
    border_width = _number(content.get("borderWidth"), 3, 1, 12) * min(width, height) / 600
    if border_style in {"thin", "double"}:
        inset = border_width * 2
        page.draw_rect(
            fitz.Rect(inset, inset, width - inset, height - inset),
            color=border_color,
            width=max(0.6, border_width),
            overlay=True,
        )
        if border_style == "double":
            inset2 = inset + border_width * 3
            page.draw_rect(
                fitz.Rect(inset2, inset2, width - inset2, height - inset2),
                color=border_color,
                width=max(0.6, border_width),
                overlay=True,
            )

    accent_style = str(content.get("accentStyle") or "none").lower()
    accent = _color(content.get("accentColor"), (0.33, 0.78, 0.83))
    thickness = max(5.0, min(width, height) * 0.018)
    if accent_style == "top":
        page.draw_rect(fitz.Rect(0, 0, width, thickness), color=None, fill=accent, overlay=True)
    elif accent_style == "bottom":
        page.draw_rect(fitz.Rect(0, height - thickness, width, height), color=None, fill=accent, overlay=True)
    elif accent_style == "left":
        page.draw_rect(fitz.Rect(0, 0, thickness, height), color=None, fill=accent, overlay=True)
    elif accent_style == "corners":
        length = min(width, height) * 0.12
        for rect in (
            fitz.Rect(0, 0, length, thickness),
            fitz.Rect(0, 0, thickness, length),
            fitz.Rect(width - length, height - thickness, width, height),
            fitz.Rect(width - thickness, height - length, width, height),
        ):
            page.draw_rect(rect, color=None, fill=accent, overlay=True)


def _draw_badge(page: fitz.Page, content: dict):
    text = _text(content.get("badgeText"))[:40]
    if not text:
        return
    width = page.rect.width
    bg = _color(content.get("badgeBg"), (0.09, 0.41, 0.88))
    size = max(8.0, min(14.0, width * 0.022))
    text_width = min(width * 0.45, _measure_text(text, size))
    pad_x, pad_y = size * 0.8, size * 0.55
    badge_w = text_width + pad_x * 2
    badge_h = size + pad_y * 2
    position = str(content.get("badgePosition") or "top-left").lower()
    margin = max(14.0, width * 0.035)
    if position == "top-center":
        x0 = (width - badge_w) / 2
    elif position == "top-right":
        x0 = width - margin - badge_w
    else:
        x0 = margin
    y0 = margin
    rect = fitz.Rect(x0, y0, x0 + badge_w, y0 + badge_h)
    page.draw_rect(rect, color=None, fill=bg, fill_opacity=0.94, overlay=True)
    page.insert_textbox(
        rect,
        text,
        fontsize=size,
        fontname=CJK_FONT_NAME,
        color=(1.0, 1.0, 1.0),
        align=fitz.TEXT_ALIGN_CENTER,
        overlay=True,
    )


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

    # New divider-design documents carry textAlign/titleSize. Older saved files
    # keep the historical positions and font sizes unchanged.
    modern_design = "textAlign" in content or "titleSize" in content
    if modern_design:
        align_name = str(content.get("textAlign") or "center").lower()
        x_pct = 10 if align_name == "left" else 90 if align_name == "right" else 50
        valign = str(content.get("textVAlign") or "center").lower()
        base_y = 22 if valign == "top" else 78 if valign == "bottom" else 50
        title_y_pct = base_y - (5.5 if subtitle else 0) + offset
        subtitle_y_pct = base_y + 8 + offset
        note_y_pct = 88
        title_x_pct = subtitle_x_pct = note_x_pct = x_pct
        title_size = _number(content.get("titleSize"), 52, 24, 90)
        subtitle_size = _number(content.get("subtitleSize"), 28, 12, 50)
        note_size = _number(content.get("noteSize"), 16, 8, 30)
    else:
        title_y_pct = _number(content.get("titleY"), 45, 5, 95) + offset
        subtitle_y_pct = _number(content.get("subtitleY"), 55, 5, 95) + offset
        note_y_pct = _number(content.get("noteY"), 88, 5, 95) + offset
        title_x_pct = _number(content.get("titleX"), 50, 5, 95)
        subtitle_x_pct = _number(content.get("subtitleX"), 50, 5, 95)
        note_x_pct = _number(content.get("noteX"), 50, 5, 95)
        title_size, subtitle_size, note_size = 42, 24, 15

    title_y = paper_h_pt * _number(title_y_pct, 45, 0, 100) / 100
    subtitle_y = paper_h_pt * _number(subtitle_y_pct, 55, 0, 100) / 100
    note_y = paper_h_pt * _number(note_y_pct, 88, 0, 100) / 100
    page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)

    if not no_bg:
        page.draw_rect(page.rect, color=None, fill=bg, overlay=True)

    layers = _local_image_layers(content)
    inserted_layers = 0
    for layer in layers:
        if _insert_image_layer(page, layer):
            inserted_layers += 1

    legacy_image = None
    if not layers:
        legacy_image = _local_image_bytes(content)
        if legacy_image:
            try:
                page.insert_image(page.rect, stream=legacy_image, keep_proportion=False, overlay=True)
            except Exception:
                legacy_image = None

    _draw_pattern(page, content)

    has_visual_background = inserted_layers > 0 or legacy_image is not None or not no_bg
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

    _draw_frame_and_accent(page, content)
    _draw_badge(page, content)
    _insert_textbox(page, title, title_x_pct, title_y, title_size, fg, 1)
    _insert_textbox(page, subtitle, subtitle_x_pct, subtitle_y, subtitle_size, fg, 0.82)
    _insert_textbox(page, note, note_x_pct, note_y, note_size, fg, 0.68)
    extra_texts = content.get("extraTexts")
    if isinstance(extra_texts, list):
        for item in extra_texts[:MAX_EXTRA_TEXTS]:
            if isinstance(item, dict):
                _draw_extra_text(page, item)
