"""Color-aware background cleanup for scanned and colored-paper PDFs."""
from __future__ import annotations

from PIL import Image, ImageChops, ImageOps


STRENGTHS = {
    "light": {"paper_luma": 205, "distance": 34, "whiten": 0.72},
    "medium": {"paper_luma": 185, "distance": 52, "whiten": 0.88},
    "strong": {"paper_luma": 155, "distance": 76, "whiten": 1.0},
}


def _rgb_metrics(rgb: tuple[int, int, int]) -> tuple[float, float]:
    r, g, b = rgb
    maximum = max(r, g, b)
    minimum = min(r, g, b)
    luminance = 0.299 * r + 0.587 * g + 0.114 * b
    saturation = (maximum - minimum) / maximum if maximum else 0.0
    return luminance, saturation


def estimate_background_color(image: Image.Image) -> tuple[int, int, int] | None:
    """Find a dominant light/chromatic paper color without inspecting every pixel."""
    sample = image.resize((64, 64), Image.Resampling.BILINEAR).convert("RGB")
    quantized = sample.quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette() or []
    histogram = quantized.histogram()
    best = None
    best_score = 0.0
    for index, count in enumerate(histogram[:32]):
        if not count:
            continue
        offset = index * 3
        if offset + 2 >= len(palette):
            continue
        rgb = tuple(int(max(0, min(255, palette[offset + channel]))) for channel in range(3))
        luminance, saturation = _rgb_metrics(rgb)
        if luminance < 150 or saturation < 0.035:
            continue
        # Colored paper should win over white text/background when it occupies
        # a meaningful portion of the page. Luminance keeps dark text protected.
        score = count * saturation * (luminance / 255.0)
        if score > best_score:
            best_score = score
            best = rgb
    return best


def _solid_image(size: tuple[int, int], color: tuple[int, int, int]) -> Image.Image:
    return Image.new("RGB", size, color)


def _distance_mask(image: Image.Image, background: tuple[int, int, int], threshold: int, min_luma: int) -> Image.Image:
    background_image = _solid_image(image.size, background)
    diff = ImageChops.difference(image, background_image)
    distance = ImageOps.grayscale(diff)
    # Small distance from the estimated paper color = likely background.
    close = distance.point(lambda value: 255 if value <= threshold else 0, mode="L")
    luminance = ImageOps.grayscale(image).point(
        lambda value: 255 if value >= min_luma else 0,
        mode="L",
    )
    return ImageChops.multiply(close, luminance)


def _white_lift(image: Image.Image, mask: Image.Image, amount: float) -> Image.Image:
    white = _solid_image(image.size, (255, 255, 255))
    if amount < 1.0:
        mask = mask.point(lambda value: round(value * amount), mode="L")
    return Image.composite(white, image, mask)


def clean_image_background(image: Image.Image, strength: str) -> Image.Image:
    setting = STRENGTHS.get(strength)
    if setting is None:
        raise ValueError("배경 제거 강도 설정이 올바르지 않습니다.")

    image = image.convert("RGB")
    background = estimate_background_color(image)
    result = image

    # First remove a dominant colored paper/background such as yellow, pink,
    # beige or light cyan. This is the part the previous grayscale LUT missed.
    if background is not None:
        mask = _distance_mask(
            result,
            background,
            int(setting["distance"]),
            int(setting["paper_luma"]),
        )
        result = _white_lift(result, mask, float(setting["whiten"]))

    # Always perform the existing light-gray/white paper cleanup as a second
    # pass so ordinary scanned pages continue to behave as before.
    gray_threshold = {"light": 238, "medium": 222, "strong": 202}[strength]
    lut = []
    lift = {"light": 0.35, "medium": 0.58, "strong": 0.78}[strength]
    dark_guard = 72
    for value in range(256):
        if value >= gray_threshold:
            lut.append(255)
        elif value <= dark_guard:
            lut.append(value)
        else:
            progress = (value - dark_guard) / max(1, gray_threshold - dark_guard)
            amount = lift * max(0.0, min(1.0, progress))
            lut.append(min(255, round(value + (255 - value) * amount)))
    result = result.point(lut * 3)
    return result


def install(router_module) -> None:
    """Replace the background raster step while keeping the router/API contract."""
    original = router_module._clean_background_document

    def clean_background_document(source, output, strength):
        if source.page_count > router_module.MAX_BACKGROUND_PAGES:
            raise ValueError(
                f"배경색 제거는 최대 {router_module.MAX_BACKGROUND_PAGES}페이지까지 처리할 수 있습니다."
            )
        projected_pixels = 0
        for page in source:
            projected_pixels += int(
                page.rect.width * router_module.BACKGROUND_DPI / 72
                * page.rect.height * router_module.BACKGROUND_DPI / 72
            )
            if projected_pixels > router_module.MAX_BACKGROUND_PIXELS:
                raise ValueError("PDF 해상도와 페이지 수가 배경 제거 처리 한도를 초과합니다.")

        for page in source:
            pixmap = page.get_pixmap(
                dpi=router_module.BACKGROUND_DPI,
                colorspace=router_module.fitz.csRGB,
                alpha=False,
                annots=True,
            )
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            cleaned = clean_image_background(image, strength)
            jpeg_buffer = router_module.io.BytesIO()
            cleaned.save(
                jpeg_buffer,
                format="JPEG",
                quality=90,
                optimize=True,
                dpi=(router_module.BACKGROUND_DPI, router_module.BACKGROUND_DPI),
            )
            new_page = output.new_page(width=page.rect.width, height=page.rect.height)
            new_page.insert_image(new_page.rect, stream=jpeg_buffer.getvalue())
            image.close()
            cleaned.close()
        return source.page_count

    clean_background_document.__name__ = original.__name__
    router_module._clean_background_document = clean_background_document
