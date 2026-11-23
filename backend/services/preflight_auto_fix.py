"""Print-production PDF corrections selected by the operator.

This processor intentionally does not try to fabricate missing detail or fonts.
CMYK conversion is performed through MuPDF's built-in CMYK profile; users must
still proof against their actual press / printer ICC profile.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

import fitz
from PIL import Image, ImageFilter

PT_PER_MM = 72 / 25.4
MAX_AUTO_FIX_PAGES = 60
MAX_TOTAL_RENDER_PIXELS = 520_000_000
MAX_PAGE_RENDER_PIXELS = 25_000_000
ALLOWED_DPI = {200, 300, 400}
PdfSource = bytes | str | Path


@dataclass(frozen=True)
class AutoFixResult:
    data: bytes
    page_count: int
    color_mode: str
    render_dpi: int
    added_bleed_mm: float
    safety_margin_mm: float
    font_rasterized: bool
    transparency_flattened: bool
    sharpened: bool


def _open_source(source_input: PdfSource) -> fitz.Document:
    try:
        if isinstance(source_input, (str, Path)):
            return fitz.open(str(source_input))
        return fitz.open(stream=source_input, filetype="pdf")
    except Exception as exc:
        raise ValueError("PDF 파일을 열 수 없습니다.") from exc


def _expand_edge(image: Image.Image, px: int) -> Image.Image:
    """Extend edge pixels; never misrepresent this as genuine artwork bleed."""
    if px <= 0:
        return image
    w, h = image.size
    out = Image.new("RGB", (w + px * 2, h + px * 2), "white")
    out.paste(image, (px, px))
    out.paste(image.crop((0, 0, w, 1)).resize((w, px)), (px, 0))
    out.paste(image.crop((0, h - 1, w, h)).resize((w, px)), (px, px + h))
    out.paste(image.crop((0, 0, 1, h)).resize((px, h)), (0, px))
    out.paste(image.crop((w - 1, 0, w, h)).resize((px, h)), (px + w, px))
    out.paste(Image.new("RGB", (px, px), image.getpixel((0, 0))), (0, 0))
    out.paste(Image.new("RGB", (px, px), image.getpixel((w - 1, 0))), (px + w, 0))
    out.paste(Image.new("RGB", (px, px), image.getpixel((0, h - 1))), (0, px + h))
    out.paste(Image.new("RGB", (px, px), image.getpixel((w - 1, h - 1))), (px + w, px + h))
    return out


def _shrink_within_trim(image: Image.Image, margin_px: int) -> Image.Image:
    if margin_px <= 0:
        return image
    w, h = image.size
    if margin_px * 2 >= min(w, h):
        raise ValueError("안전여백이 페이지 크기보다 큽니다.")
    inside = image.resize((w - 2 * margin_px, h - 2 * margin_px), Image.Resampling.LANCZOS)
    white = Image.new("RGB", (w, h), "white")
    white.paste(inside, (margin_px, margin_px))
    return white


def auto_fix_pdf_source(
    source_input: PdfSource,
    *,
    convert_cmyk: bool = False,
    protect_fonts: bool = False,
    flatten_transparency: bool = False,
    add_bleed_mm: float = 0.0,
    safe_margin_mm: float = 0.0,
    enhance_sharpness: bool = False,
    render_dpi: int = 300,
) -> AutoFixResult:
    if not any((convert_cmyk, protect_fonts, flatten_transparency,
                add_bleed_mm, safe_margin_mm, enhance_sharpness)):
        raise ValueError("수정할 인쇄 문제를 하나 이상 선택하세요.")
    if type(render_dpi) is not int or render_dpi not in ALLOWED_DPI:
        raise ValueError("출력 해상도는 200, 300 또는 400DPI로 선택하세요.")
    if add_bleed_mm not in (0.0, 3.0):
        raise ValueError("도련은 0mm 또는 3mm만 지원합니다.")
    if safe_margin_mm not in (0.0, 3.0):
        raise ValueError("안전여백은 0mm 또는 3mm만 지원합니다.")
    source = _open_source(source_input)
    target = fitz.open()
    try:
        if source.is_encrypted or source.needs_pass:
            raise ValueError("암호화된 PDF는 먼저 암호를 해제하세요.")
        if not 1 <= len(source) <= MAX_AUTO_FIX_PAGES:
            raise ValueError(f"인쇄 보정은 한 번에 최대 {MAX_AUTO_FIX_PAGES}페이지까지 지원합니다.")
        pixels_total = 0
        factor = render_dpi / 72.0
        bleed_pt = add_bleed_mm * PT_PER_MM
        for page in source:
            rect = page.rect
            w = round(rect.width * factor)
            h = round(rect.height * factor)
            bleed_px = round(add_bleed_mm * render_dpi / 25.4)
            if w < 2 or h < 2 or (w + 2 * bleed_px) * (h + 2 * bleed_px) > MAX_PAGE_RENDER_PIXELS:
                raise ValueError("출력 페이지가 너무 큽니다. DPI를 낮추거나 페이지를 분할해 주세요.")
            pixels_total += (w + 2 * bleed_px) * (h + 2 * bleed_px)
            if pixels_total > MAX_TOTAL_RENDER_PIXELS:
                raise ValueError("처리할 총 이미지량이 너무 큽니다. 파일을 나누거나 DPI를 낮춰 주세요.")

            # Flatten page appearance onto white, retaining visual positioning
            # but not the editable/searchable vector and font layers.
            pix = page.get_pixmap(
                matrix=fitz.Matrix(factor, factor),
                colorspace=fitz.csRGB,
                alpha=False,
                annots=True,
            )
            image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            if enhance_sharpness:
                image = image.filter(ImageFilter.UnsharpMask(radius=1.0, percent=60, threshold=3))
            if safe_margin_mm:
                image = _shrink_within_trim(image, round(safe_margin_mm * render_dpi / 25.4))
            if add_bleed_mm:
                image = _expand_edge(image, bleed_px)

            as_rgb = fitz.Pixmap(fitz.csRGB, image.width, image.height, image.tobytes(), False)
            final_pix = fitz.Pixmap(fitz.csCMYK, as_rgb) if convert_cmyk else as_rgb
            jpeg = final_pix.tobytes("jpg", jpg_quality=94)
            out_page = target.new_page(
                width=rect.width + 2 * bleed_pt,
                height=rect.height + 2 * bleed_pt,
            )
            out_page.insert_image(out_page.rect, stream=jpeg, keep_proportion=False)
            if bleed_pt:
                # Trim size remains identical to the original page.
                out_page.set_trimbox(fitz.Rect(
                    bleed_pt, bleed_pt, bleed_pt + rect.width, bleed_pt + rect.height
                ))
                out_page.set_bleedbox(out_page.mediabox)

        dest = io.BytesIO()
        target.save(dest, garbage=4, deflate=True, clean=True)
        return AutoFixResult(
            data=dest.getvalue(),
            page_count=len(source),
            color_mode="CMYK (MuPDF SWOP)" if convert_cmyk else "RGB (rendered)",
            render_dpi=render_dpi,
            added_bleed_mm=add_bleed_mm,
            safety_margin_mm=safe_margin_mm,
            font_rasterized=protect_fonts or convert_cmyk or flatten_transparency
                or bool(add_bleed_mm) or bool(safe_margin_mm) or enhance_sharpness,
            transparency_flattened=True,
            sharpened=enhance_sharpness,
        )
    finally:
        target.close()
        source.close()


def auto_fix_pdf_bytes(data: bytes, **options) -> AutoFixResult:
    """Convenience entry point for tests and direct PDF uploads."""
    return auto_fix_pdf_source(data, **options)
