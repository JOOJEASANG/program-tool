"""Add genuine print bleed *outside* a supplied design without repainting its interior.

PDF content stays vector / searchable. Only the newly created outer strips
are raster samples, reflected or stretched from the original visible edges.
Not AI outpainting: backgrounds with faces, text or irregular patterns at the
edge still require human review.
"""
from __future__ import annotations

import io
import math
from dataclasses import dataclass
from pathlib import Path

import fitz
from PIL import Image, ImageOps, UnidentifiedImageError

PT_PER_MM = 72.0 / 25.4
MAX_PAGES = 80
MAX_RASTER_PIXELS = 45_000_000
BORDER_RENDER_DPI = 300
MAX_IMAGE_PIXELS = 64_000_000
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
MODES = {"mirror", "edge"}
FIT_MODES = {"contain", "cover"}


@dataclass(frozen=True)
class BleedResult:
    pdf: bytes
    page_count: int
    trim_width_mm: float
    trim_height_mm: float
    bleed_mm: float
    edge_mode: str
    warnings: tuple[str, ...]


def _input_pdf(source: bytes | Path, filename: str):
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("PDF, JPG, PNG, WEBP 파일만 지원합니다.")
    content = source.read_bytes() if isinstance(source, Path) else bytes(source)
    if not content:
        raise ValueError("비어 있는 파일입니다.")
    if ext == ".pdf":
        try:
            doc = fitz.open(stream=content, filetype="pdf")
        except Exception as exc:
            raise ValueError("PDF를 열 수 없습니다. 정상 파일인지 확인해 주세요.") from exc
        if doc.needs_pass or doc.is_encrypted:
            doc.close()
            raise ValueError("암호화된 PDF는 암호 해제 후 업로드해 주세요.")
        return doc, None

    try:
        with Image.open(io.BytesIO(content)) as input_img:
            input_img.verify()
        with Image.open(io.BytesIO(content)) as input_img:
            input_img = ImageOps.exif_transpose(input_img)
            if input_img.width * input_img.height > MAX_IMAGE_PIXELS:
                raise ValueError("이미지 픽셀이 너무 많습니다. 파일을 분할해 주세요.")
            if input_img.mode in {"RGBA", "LA"} or "transparency" in input_img.info:
                rgba = input_img.convert("RGBA")
                bg = Image.new("RGB", rgba.size, (255, 255, 255))
                bg.paste(rgba, mask=rgba.getchannel("A"))
                image = bg
            else:
                image = input_img.convert("RGB")
            original_pixels = image.size
            buf = io.BytesIO()
            image.save(buf, format="PNG", optimize=True)
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("이미지 파일을 읽을 수 없습니다.") from exc
    image_doc = fitz.open(stream=buf.getvalue(), filetype="png")
    try:
        data = image_doc.convert_to_pdf()
    finally:
        image_doc.close()
    doc = fitz.open(stream=data, filetype="pdf")
    return doc, original_pixels


def _png_bytes(im: Image.Image) -> bytes:
    b = io.BytesIO()
    im.save(b, format="PNG", optimize=True)
    return b.getvalue()


def _edge_strips(image: Image.Image, px: int, mode: str):
    w, h = image.size
    if px <= 0 or px >= min(w, h):
        raise ValueError("도련 폭에 비해 페이지가 너무 작습니다.")
    if mode == "mirror":
        return {
            "top": ImageOps.flip(image.crop((0, 0, w, px))),
            "bottom": ImageOps.flip(image.crop((0, h - px, w, h))),
            "left": ImageOps.mirror(image.crop((0, 0, px, h))),
            "right": ImageOps.mirror(image.crop((w - px, 0, w, h))),
            "tl": ImageOps.flip(ImageOps.mirror(image.crop((0, 0, px, px)))),
            "tr": ImageOps.flip(ImageOps.mirror(image.crop((w - px, 0, w, px)))),
            "bl": ImageOps.flip(ImageOps.mirror(image.crop((0, h - px, px, h)))),
            "br": ImageOps.flip(ImageOps.mirror(image.crop((w - px, h - px, w, h)))),
        }
    return {
        "top": image.crop((0, 0, w, 1)).resize((w, px)),
        "bottom": image.crop((0, h-1, w, h)).resize((w, px)),
        "left": image.crop((0, 0, 1, h)).resize((px, h)),
        "right": image.crop((w-1, 0, w, h)).resize((px, h)),
        "tl": Image.new("RGB", (px, px), image.getpixel((0, 0))),
        "tr": Image.new("RGB", (px, px), image.getpixel((w-1, 0))),
        "bl": Image.new("RGB", (px, px), image.getpixel((0, h-1))),
        "br": Image.new("RGB", (px, px), image.getpixel((w-1, h-1))),
    }


def _insert_border(page: fitz.Page, source: Image.Image, trim: fitz.Rect, bleed_pt: float, mode: str):
    # The border is just a few mm wide. Source artwork in trim stays native PDF.
    px = max(1, round(bleed_pt / 72.0 * BORDER_RENDER_DPI))
    strips = _edge_strips(source, px, mode)
    b = bleed_pt
    left, top, right, bottom = trim.x0, trim.y0, trim.x1, trim.y1
    regions = {
        "top": fitz.Rect(left, top-b, right, top),
        "bottom": fitz.Rect(left, bottom, right, bottom+b),
        "left": fitz.Rect(left-b, top, left, bottom),
        "right": fitz.Rect(right, top, right+b, bottom),
        "tl": fitz.Rect(left-b, top-b, left, top),
        "tr": fitz.Rect(right, top-b, right+b, top),
        "bl": fitz.Rect(left-b, bottom, left, bottom+b),
        "br": fitz.Rect(right, bottom, right+b, bottom+b),
    }
    for key, rect in regions.items():
        page.insert_image(rect, stream=_png_bytes(strips[key]), keep_proportion=False)


def _source_clip(page: fitz.Page, dest: fitz.Rect) -> fitz.Rect:
    src = page.rect
    dest_ratio = dest.width / dest.height
    src_ratio = src.width / src.height
    if src_ratio > dest_ratio:
        new_w = src.height * dest_ratio
        pad = (src.width - new_w) / 2
        return fitz.Rect(src.x0 + pad, src.y0, src.x1 - pad, src.y1)
    new_h = src.width / dest_ratio
    pad = (src.height - new_h) / 2
    return fitz.Rect(src.x0, src.y0 + pad, src.x1, src.y1 - pad)


def extend_print_bleed(
    source: bytes | Path,
    *,
    filename: str,
    trim_width_mm: float | None = None,
    trim_height_mm: float | None = None,
    bleed_mm: float = 3,
    edge_mode: str = "mirror",
    fit_mode: str = "contain",
) -> BleedResult:
    if edge_mode not in MODES:
        raise ValueError("배경 확장 방식을 다시 선택해 주세요.")
    if fit_mode not in FIT_MODES:
        raise ValueError("크기 맞춤 방식을 다시 선택해 주세요.")
    if not math.isfinite(float(bleed_mm)) or not 1 <= float(bleed_mm) <= 10:
        raise ValueError("도련은 1~10mm 사이로 입력해 주세요.")
    bleed_mm = float(bleed_mm)
    for dimension in (trim_width_mm, trim_height_mm):
        if dimension is not None and (not math.isfinite(float(dimension)) or not 10 <= float(dimension) <= 1500):
            raise ValueError("완성 크기는 10~1,500mm로 입력해 주세요.")
    if (trim_width_mm is None) != (trim_height_mm is None):
        raise ValueError("완성 가로와 세로를 모두 입력해 주세요.")

    pdf, image_pixels = _input_pdf(source, filename)
    target = fitz.open()
    warnings: list[str] = []
    try:
        if not 1 <= len(pdf) <= MAX_PAGES:
            raise ValueError(f"한 번에 최대 {MAX_PAGES}페이지까지 처리할 수 있습니다.")
        if image_pixels:
            warnings.append("이미지 원본의 실물 크기·유효 DPI는 사용자가 입력한 완성 규격에 따라 달라집니다.")
        if fit_mode == "cover":
            warnings.append("비율이 다르면 가운데를 기준으로 원본 가장자리가 잘릴 수 있습니다.")
        else:
            warnings.append("원본과 완성 규격의 비율이 다르면 안쪽에 흰 여백이 생길 수 있습니다.")
        warnings.append("거울 반사·가장자리 늘리기는 실제 원본 배경을 새로 그리는 AI 확장이 아닙니다. 인물·글자·복잡한 무늬는 재단 전 반드시 확인하세요.")
        bpt = bleed_mm * PT_PER_MM
        first_w = first_h = 0.0
        for i, original in enumerate(pdf):
            if trim_width_mm is None:
                wpt, hpt = float(original.rect.width), float(original.rect.height)
            else:
                wpt = float(trim_width_mm) * PT_PER_MM
                hpt = float(trim_height_mm) * PT_PER_MM
            if wpt < 10 * PT_PER_MM or hpt < 10 * PT_PER_MM:
                raise ValueError("완성 크기는 최소 10mm 이상이어야 합니다.")
            if i == 0:
                first_w, first_h = wpt, hpt
            page = target.new_page(width=wpt+2*bpt, height=hpt+2*bpt)
            trim = fitz.Rect(bpt, bpt, bpt+wpt, bpt+hpt)
            page.draw_rect(trim, color=None, fill=(1, 1, 1), overlay=False)
            clip = _source_clip(original, trim) if fit_mode == "cover" else None
            page.show_pdf_page(trim, pdf, i, clip=clip, keep_proportion=True, overlay=True)
            # Sample *output trim*, not original, so contain/cover behavior matches
            # the actual page exactly. 144-DPI strip pixels are not the artwork.
            pxw = math.ceil(wpt / 72 * BORDER_RENDER_DPI)
            pxh = math.ceil(hpt / 72 * BORDER_RENDER_DPI)
            if pxw * pxh > MAX_RASTER_PIXELS:
                raise ValueError("너무 큰 디자인입니다. 페이지를 나누거나 완성 크기를 줄여 주세요.")
            pix = page.get_pixmap(
                matrix=fitz.Matrix(BORDER_RENDER_DPI / 72, BORDER_RENDER_DPI / 72),
                clip=trim, colorspace=fitz.csRGB, alpha=False
            )
            rendered = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            _insert_border(page, rendered, trim, bpt, edge_mode)
            page.set_trimbox(trim)
            page.set_bleedbox(page.mediabox)
        stream = io.BytesIO()
        target.set_metadata({"title":"Bleed-extended print file", "keywords":"trimbox,bleedbox,print"})
        target.save(stream, garbage=4, deflate=True, clean=True)
        return BleedResult(
            pdf=stream.getvalue(), page_count=len(pdf),
            trim_width_mm=round(first_w / PT_PER_MM, 2),
            trim_height_mm=round(first_h / PT_PER_MM, 2),
            bleed_mm=bleed_mm, edge_mode=edge_mode, warnings=tuple(warnings),
        )
    finally:
        target.close()
        pdf.close()
