"""Render divider pages with the same fields used by the browser editor."""
from __future__ import annotations

import base64
import binascii
import math
import re

import fitz

from services import pdf_ops


CJK_FONT_NAME = "korea"
MAX_EXTRA_TEXTS = 30
MAX_SHAPE_LAYERS = 24
MAX_TEXT_LENGTH = 500
MAX_TITLE_LENGTH = 240
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


def _title_text(value) -> str:
    raw = str(value or "").replace("\r", "")[:MAX_TITLE_LENGTH]
    parts = raw.split("\n")
    if len(parts) <= 2:
        return raw
    return f"{parts[0]}\n{' '.join(parts[1:])}"[:MAX_TITLE_LENGTH]


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


def _wrap_two_lines(text: str, size: float, max_width: float) -> list[str]:
    cleaned = _title_text(text).strip()
    if not cleaned:
        return []
    explicit = cleaned.split("\n")
    if len(explicit) > 1:
        return explicit[:2]
    if _measure_text(cleaned, size) <= max_width:
        return [cleaned]
    split = 1
    for index in range(1, len(cleaned)):
        if _measure_text(cleaned[: index + 1], size) > max_width:
            split = index
            break
    before = cleaned[:split]
    whitespace = before.rfind(" ")
    if whitespace > int(split * 0.45):
        split = whitespace
    return [part.strip() for part in (cleaned[:split], cleaned[split:]) if part.strip()][:2]


def _insert_title(page: fitz.Page, text: str, x_pct: float, y: float, size: float, color):
    lines = _wrap_two_lines(text, size, page.rect.width * 0.84)
    if not lines:
        return
    line_height = size * 1.18
    total_height = max(size * 1.5, line_height * len(lines) + size * 0.35)
    rect, align = _text_rect(
        page.rect.width,
        x_pct,
        max(0, y - total_height / 2),
        min(page.rect.height, y + total_height / 2),
        page.rect.width * 0.08,
    )
    page.insert_textbox(
        rect,
        "\n".join(lines),
        fontsize=size,
        fontname=CJK_FONT_NAME,
        color=color,
        align=align,
        lineheight=1.18,
        fill_opacity=1,
        overlay=True,
    )


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


def _mix_color(a, b, amount: float):
    t = max(0.0, min(1.0, amount))
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3))


def _draw_background(page: fitz.Page, content: dict, bg, fg):
    if content.get("noBg") is not False:
        return
    bg2 = _color(content.get("bg2"), (0.86, 0.92, 0.99))
    style = str(content.get("bgStyle") or "solid")
    width, height = page.rect.width, page.rect.height
    if style in {"gradient", "soft", "spotlight"}:
        bands = 32
        for index in range(bands):
            y0 = height * index / bands
            y1 = height * (index + 1) / bands + 0.5
            ratio = index / max(1, bands - 1)
            if style == "gradient":
                color = _mix_color(bg, bg2, ratio)
            elif style == "soft":
                color = _mix_color(bg2, bg, min(1.0, ratio * 1.35))
            else:
                distance = abs(ratio - 0.42) / 0.58
                color = _mix_color(bg2, bg, min(1.0, distance))
            page.draw_rect(fitz.Rect(0, y0, width, y1), color=None, fill=color, overlay=True)
    else:
        page.draw_rect(page.rect, color=None, fill=bg, overlay=True)

    if style == "diagonal":
        shape = page.new_shape()
        step = max(24.0, width * 0.08)
        x = -height
        while x < width + height:
            shape.draw_line(fitz.Point(x, 0), fitz.Point(x - height, height))
            x += step
        shape.finish(color=fg, width=max(1, width * 0.012), stroke_opacity=0.09)
        shape.commit(overlay=True)
    elif style == "grid":
        shape = page.new_shape()
        step = max(24.0, width * 0.08)
        x = 0.0
        while x <= width:
            shape.draw_line(fitz.Point(x, 0), fitz.Point(x, height))
            x += step
        y = 0.0
        while y <= height:
            shape.draw_line(fitz.Point(0, y), fitz.Point(width, y))
            y += step
        shape.finish(color=fg, width=max(0.7, width * 0.0015), stroke_opacity=0.10)
        shape.commit(overlay=True)


def _rotated_point(cx: float, cy: float, x: float, y: float, degrees: float) -> fitz.Point:
    if not degrees:
        return fitz.Point(x, y)
    radians = math.radians(degrees)
    dx, dy = x - cx, y - cy
    return fitz.Point(
        cx + dx * math.cos(radians) - dy * math.sin(radians),
        cy + dx * math.sin(radians) + dy * math.cos(radians),
    )


def _draw_shape_layer(page: fitz.Page, item: dict):
    if item.get("hidden") is True:
        return
    kind = str(item.get("kind") or "roundRect")
    if kind not in {"rect", "roundRect", "outline", "pill", "line", "circle"}:
        kind = "roundRect"
    pw, ph = page.rect.width, page.rect.height
    cx = pw * _number(item.get("x"), 50, 0, 100) / 100
    cy = ph * _number(item.get("y"), 45, 0, 100) / 100
    width = pw * _number(item.get("width"), 50, 1, 100) / 100
    height = ph * _number(item.get("height"), 12, 0.3, 100) / 100
    fill = _color(item.get("fill"), (1.0, 1.0, 1.0))
    stroke = _color(item.get("stroke"), (0.07, 0.16, 0.29))
    stroke_width = _number(item.get("strokeWidth"), 1, 0, 12)
    radius = _number(item.get("radius"), 4, 0, 50)
    opacity = _number(item.get("opacity"), 0.8, 0, 1)
    rotation = _number(item.get("rotation"), 0, -180, 180)

    if kind == "line":
        start = _rotated_point(cx, cy, cx - width / 2, cy, rotation)
        end = _rotated_point(cx, cy, cx + width / 2, cy, rotation)
        page.draw_line(start, end, color=stroke, width=max(0.5, stroke_width), stroke_opacity=opacity, overlay=True)
        return

    rect = fitz.Rect(cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2)
    if kind == "circle":
        page.draw_oval(
            rect,
            color=stroke if stroke_width > 0 else None,
            fill=fill,
            width=max(0.5, stroke_width),
            stroke_opacity=opacity,
            fill_opacity=opacity,
            overlay=True,
        )
        return

    if rotation:
        points = [
            _rotated_point(cx, cy, rect.x0, rect.y0, rotation),
            _rotated_point(cx, cy, rect.x1, rect.y0, rotation),
            _rotated_point(cx, cy, rect.x1, rect.y1, rotation),
            _rotated_point(cx, cy, rect.x0, rect.y1, rotation),
        ]
        shape = page.new_shape()
        shape.draw_polyline(points + [points[0]])
        shape.finish(
            color=stroke if stroke_width > 0 or kind == "outline" else None,
            fill=None if kind == "outline" else fill,
            width=max(0.5, stroke_width),
            stroke_opacity=opacity,
            fill_opacity=opacity,
            closePath=True,
        )
        shape.commit(overlay=True)
        return

    # PyMuPDF draw_rect radius is a ratio of the smaller side (0..0.5),
    # while the editor stores a 0..50 percentage for the visible corner radius.
    radius_ratio = 0.0
    if kind == "pill":
        radius_ratio = 0.5
    elif kind == "roundRect":
        radius_ratio = min(0.5, radius / 100)
    page.draw_rect(
        rect,
        color=stroke if stroke_width > 0 or kind == "outline" else None,
        fill=None if kind == "outline" else fill,
        width=max(0.5, stroke_width),
        radius=radius_ratio if radius_ratio > 0 else None,
        stroke_opacity=opacity,
        fill_opacity=opacity,
        overlay=True,
    )


def _draw_base_style(page: fitz.Page, resolved_style: str, fg):
    width, height = page.rect.width, page.rect.height
    if resolved_style == "band":
        page.draw_rect(fitz.Rect(0, height * 0.34, width, height * 0.66), color=None, fill=fg, fill_opacity=0.16, overlay=True)
    elif resolved_style == "lines":
        shape = page.new_shape()
        shape.draw_line(fitz.Point(width * 0.14, height * 0.36), fitz.Point(width * 0.86, height * 0.36))
        shape.draw_line(fitz.Point(width * 0.14, height * 0.66), fitz.Point(width * 0.86, height * 0.66))
        shape.finish(color=fg, width=max(1, width * 0.002), stroke_opacity=0.28)
        shape.commit(overlay=True)
    elif resolved_style == "frame":
        page.draw_rect(fitz.Rect(width * 0.07, height * 0.05, width * 0.93, height * 0.95), color=fg, width=max(2, width * 0.006), stroke_opacity=0.45, overlay=True)
        page.draw_rect(fitz.Rect(width * 0.09, height * 0.07, width * 0.91, height * 0.93), color=fg, width=max(1, width * 0.002), stroke_opacity=0.16, overlay=True)
    elif resolved_style == "corner":
        shape = page.new_shape()
        x, y, length = width * 0.12, height * 0.18, width * 0.16
        shape.draw_line(fitz.Point(x, y + length), fitz.Point(x, y))
        shape.draw_line(fitz.Point(x, y), fitz.Point(x + length, y))
        shape.finish(color=fg, width=max(2, width * 0.007), stroke_opacity=0.55)
        shape.commit(overlay=True)
    elif resolved_style == "modern":
        page.draw_rect(fitz.Rect(width * 0.08, height * 0.34, width * 0.92, height * 0.59), color=None, fill=fg, fill_opacity=0.10, overlay=True)
        page.draw_rect(fitz.Rect(width * 0.08, height * 0.34, width * 0.098, height * 0.59), color=None, fill=fg, fill_opacity=0.65, overlay=True)


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
    base_scale = max(page_w / image_w, page_h / image_h) if layer["fit"] == "cover" else min(page_w / image_w, page_h / image_h)
    scale = base_scale * layer["scale"] / 100
    draw_w = image_w * scale
    draw_h = image_h * scale
    center_x = page.rect.x0 + page_w * layer["x"] / 100
    center_y = page.rect.y0 + page_h * layer["y"] / 100
    target = fitz.Rect(center_x - draw_w / 2, center_y - draw_h / 2, center_x + draw_w / 2, center_y + draw_h / 2)
    try:
        page.insert_image(target, stream=layer["raw"], keep_proportion=True, overlay=True)
        return True
    except Exception:
        return False


def render_divider_page(out_doc: fitz.Document, content_raw: str, style: str, paper_w_pt: float, paper_h_pt: float):
    content = pdf_ops._parse_divider_content(content_raw)
    title = _title_text(content.get("title"))
    subtitle = _text(content.get("subtitle"))
    note = _text(content.get("note"))
    resolved_style = str(content.get("style") or style or "simple")
    no_bg = content.get("noBg") is not False
    configured_fg = _color(content.get("fg"), (0.0, 0.0, 0.0))
    fg = (0.0, 0.0, 0.0) if no_bg else configured_fg
    bg = _color(content.get("bg"), (1.0, 1.0, 1.0))
    offset = _number(content.get("textVOffset"), 0, -40, 40)
    title_y_pct = _number(content.get("titleY"), 45, 5, 95) + offset
    subtitle_y_pct = _number(content.get("subtitleY"), 56, 5, 95) + offset
    note_y_pct = _number(content.get("noteY"), 88, 5, 95) + offset
    title_x_pct = _number(content.get("titleX"), 50, 5, 95)
    subtitle_x_pct = _number(content.get("subtitleX"), 50, 5, 95)
    note_x_pct = _number(content.get("noteX"), 50, 5, 95)
    title_y = paper_h_pt * _number(title_y_pct, 45, 0, 100) / 100
    subtitle_y = paper_h_pt * _number(subtitle_y_pct, 56, 0, 100) / 100
    note_y = paper_h_pt * _number(note_y_pct, 88, 0, 100) / 100
    page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)

    _draw_background(page, content, bg, fg)

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

    _draw_base_style(page, resolved_style, fg)

    shape_layers = content.get("shapeLayers")
    if isinstance(shape_layers, list):
        for item in shape_layers[:MAX_SHAPE_LAYERS]:
            if isinstance(item, dict):
                _draw_shape_layer(page, item)

    _insert_title(page, title, title_x_pct, title_y, 42, fg)
    _insert_textbox(page, subtitle, subtitle_x_pct, subtitle_y, 24, fg, 0.82)
    _insert_textbox(page, note, note_x_pct, note_y, 15, fg, 0.68)

    extra_texts = content.get("extraTexts")
    if isinstance(extra_texts, list):
        for item in extra_texts[:MAX_EXTRA_TEXTS]:
            if isinstance(item, dict):
                _draw_extra_text(page, item)
