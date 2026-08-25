"""Safe print-oriented PDF auto fixes.

Only operations that do not rewrite artwork semantics are handled here:
- normalize mixed page sizes to the dominant page box while preserving vectors/text
- append blank pages for duplex (even) or saddle-stitch booklet (multiple of four)

Image DPI, fonts, color mode, bleed, and transparency are intentionally not
modified automatically because blind conversion can reduce print quality.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

import fitz

PT_TO_MM = 25.4 / 72
SIZE_TOLERANCE_PT = 3.0
MAX_AUTO_FIX_PAGES = 2000
PdfSource = bytes | str | Path


@dataclass(frozen=True)
class AutoFixResult:
    data: bytes
    normalize_page_size: bool
    pad_mode: str
    added_blank_pages: int
    target_width_pt: float | None
    target_height_pt: float | None

    @property
    def target_mm(self) -> str:
        if not self.target_width_pt or not self.target_height_pt:
            return "preserved"
        return f"{self.target_width_pt * PT_TO_MM:.1f}x{self.target_height_pt * PT_TO_MM:.1f}mm"


def _dominant_page_size(document: fitz.Document) -> tuple[float, float]:
    clusters: list[dict[str, float | int]] = []
    for page in document:
        rect = page.rect
        width = float(rect.width)
        height = float(rect.height)
        if width <= 0 or height <= 0:
            raise ValueError("유효하지 않은 페이지 크기가 포함되어 있습니다.")
        matched = None
        for cluster in clusters:
            if (
                abs(width - float(cluster["width"])) <= SIZE_TOLERANCE_PT
                and abs(height - float(cluster["height"])) <= SIZE_TOLERANCE_PT
            ):
                matched = cluster
                break
        if matched is None:
            clusters.append({"width": width, "height": height, "count": 1})
        else:
            matched["count"] = int(matched["count"]) + 1
    if not clusters:
        raise ValueError("페이지가 없습니다.")
    winner = max(enumerate(clusters), key=lambda item: (int(item[1]["count"]), -item[0]))[1]
    return float(winner["width"]), float(winner["height"])


def _fit_rect(target: fitz.Rect, source: fitz.Rect) -> fitz.Rect:
    if source.width <= 0 or source.height <= 0:
        raise ValueError("유효하지 않은 페이지 크기가 포함되어 있습니다.")
    scale = min(target.width / source.width, target.height / source.height)
    width = source.width * scale
    height = source.height * scale
    x0 = target.x0 + (target.width - width) / 2
    y0 = target.y0 + (target.height - height) / 2
    return fitz.Rect(x0, y0, x0 + width, y0 + height)


def _blank_count(page_count: int, pad_mode: str) -> int:
    if pad_mode == "even":
        return page_count % 2
    if pad_mode == "booklet":
        return (4 - (page_count % 4)) % 4
    return 0


def _open_source(source_input: PdfSource) -> fitz.Document:
    try:
        if isinstance(source_input, (str, Path)):
            return fitz.open(str(source_input))
        return fitz.open(stream=source_input, filetype="pdf")
    except Exception as exc:
        raise ValueError("PDF 파일을 열 수 없습니다.") from exc


def auto_fix_pdf_source(
    source_input: PdfSource,
    *,
    normalize_page_size: bool = False,
    pad_mode: str = "none",
) -> AutoFixResult:
    if pad_mode not in {"none", "even", "booklet"}:
        raise ValueError("지원하지 않는 페이지 보충 방식입니다.")

    source = _open_source(source_input)
    output = fitz.open()
    try:
        if source.is_encrypted:
            raise ValueError("암호화된 PDF는 먼저 암호를 해제하세요.")
        if len(source) == 0:
            raise ValueError("페이지가 없습니다.")
        if len(source) > MAX_AUTO_FIX_PAGES:
            raise ValueError(f"자동 수정은 최대 {MAX_AUTO_FIX_PAGES}페이지까지 지원합니다.")

        target_width: float | None = None
        target_height: float | None = None
        if normalize_page_size:
            target_width, target_height = _dominant_page_size(source)
            target_rect = fitz.Rect(0, 0, target_width, target_height)
            for page_index in range(len(source)):
                source_page = source[page_index]
                out_page = output.new_page(width=target_width, height=target_height)
                fit_rect = _fit_rect(target_rect, source_page.rect)
                out_page.show_pdf_page(
                    fit_rect,
                    source,
                    page_index,
                    keep_proportion=True,
                )
        else:
            output.insert_pdf(source, links=False, annots=True, widgets=True)

        added = _blank_count(len(source), pad_mode)
        if normalize_page_size:
            blank_width = float(target_width or source[-1].rect.width)
            blank_height = float(target_height or source[-1].rect.height)
        else:
            last_rect = source[-1].rect
            blank_width = float(last_rect.width)
            blank_height = float(last_rect.height)
        for _ in range(added):
            output.new_page(width=blank_width, height=blank_height)

        buffer = io.BytesIO()
        output.save(
            buffer,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
        )
        return AutoFixResult(
            data=buffer.getvalue(),
            normalize_page_size=bool(normalize_page_size),
            pad_mode=pad_mode,
            added_blank_pages=added,
            target_width_pt=target_width,
            target_height_pt=target_height,
        )
    finally:
        output.close()
        source.close()


def auto_fix_pdf_bytes(
    data: bytes,
    *,
    normalize_page_size: bool = False,
    pad_mode: str = "none",
) -> AutoFixResult:
    """Backward-compatible bytes entry point for direct uploads and tests."""
    return auto_fix_pdf_source(
        data,
        normalize_page_size=normalize_page_size,
        pad_mode=pad_mode,
    )
