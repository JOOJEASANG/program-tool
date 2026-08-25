"""Large-format print tiling while preserving PDF vectors and physical size."""
from __future__ import annotations

import io
import math
from dataclasses import dataclass

import fitz

MM_TO_PT = 72 / 25.4
PT_TO_MM = 25.4 / 72
PAPER_SIZES_MM = {
    "A4": (210.0, 297.0),
    "A3": (297.0, 420.0),
}
MAX_SOURCE_PAGES = 50
MAX_OUTPUT_SHEETS = 500


@dataclass(frozen=True)
class TilingResult:
    data: bytes
    source_pages: int
    sheet_count: int
    paper_size: str
    printer_margin_mm: float
    overlap_mm: float


def _sheet_count(source_mm: float, usable_mm: float, overlap_mm: float) -> int:
    if source_mm <= usable_mm + 1e-6:
        return 1
    step = usable_mm - overlap_mm
    if step <= 0:
        raise ValueError("겹침 여백이 인쇄 가능 영역보다 큽니다.")
    return max(1, math.ceil((source_mm - overlap_mm) / step))


def _paper_geometry(
    source_width_mm: float,
    source_height_mm: float,
    paper_size: str,
    orientation: str,
    printer_margin_mm: float,
    overlap_mm: float,
) -> tuple[float, float, int, int]:
    base = PAPER_SIZES_MM.get(paper_size)
    if not base:
        raise ValueError("지원하지 않는 출력 용지입니다.")

    candidates: list[tuple[int, float, float, int, int]] = []
    requested = orientation if orientation in {"portrait", "landscape"} else "auto"
    orientations = [requested] if requested != "auto" else ["portrait", "landscape"]
    for item in orientations:
        paper_w, paper_h = base if item == "portrait" else (base[1], base[0])
        usable_w = paper_w - printer_margin_mm * 2
        usable_h = paper_h - printer_margin_mm * 2
        if usable_w <= 0 or usable_h <= 0:
            raise ValueError("프린터 여백 때문에 인쇄 가능한 영역이 없습니다.")
        if overlap_mm >= usable_w or overlap_mm >= usable_h:
            raise ValueError("겹침 여백은 인쇄 가능 영역보다 작아야 합니다.")
        cols = _sheet_count(source_width_mm, usable_w, overlap_mm)
        rows = _sheet_count(source_height_mm, usable_h, overlap_mm)
        candidates.append((cols * rows, paper_w, paper_h, cols, rows))

    candidates.sort(key=lambda item: item[0])
    return candidates[0][1], candidates[0][2], candidates[0][3], candidates[0][4]


def _draw_sheet_label(page: fitz.Page, text: str, margin_mm: float) -> None:
    # Keep the label inside the printable area. It is deliberately tiny and only
    # occupies the top-right corner; users can disable labels from the API/UI.
    x = max(2.0, margin_mm) * MM_TO_PT
    y = max(2.0, margin_mm) * MM_TO_PT
    page.insert_text(
        (page.rect.width - x - 82, y + 7),
        text,
        fontsize=6,
        color=(0.35, 0.35, 0.35),
        overlay=True,
    )


def tile_pdf_bytes(
    data: bytes,
    *,
    paper_size: str = "A3",
    orientation: str = "auto",
    printer_margin_mm: float = 3.0,
    overlap_mm: float = 0.0,
    add_sheet_labels: bool = False,
) -> TilingResult:
    paper_size = str(paper_size or "A3").upper()
    orientation = str(orientation or "auto").lower()
    if orientation not in {"auto", "portrait", "landscape"}:
        raise ValueError("출력 방향 설정이 올바르지 않습니다.")
    if not 0 <= printer_margin_mm <= 20:
        raise ValueError("프린터 여백은 0~20mm로 설정하세요.")
    if not 0 <= overlap_mm <= 30:
        raise ValueError("겹침 여백은 0~30mm로 설정하세요.")

    try:
        source = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ValueError("PDF 파일을 열 수 없습니다.") from exc

    output = fitz.open()
    try:
        if source.is_encrypted:
            raise ValueError("암호화된 PDF는 먼저 암호를 해제하세요.")
        if source.page_count < 1:
            raise ValueError("페이지가 없습니다.")
        if source.page_count > MAX_SOURCE_PAGES:
            raise ValueError(f"대형 분할 출력은 최대 {MAX_SOURCE_PAGES}페이지까지 지원합니다.")

        sheet_number = 0
        for page_index in range(source.page_count):
            source_page = source[page_index]
            source_rect = source_page.rect
            source_w_mm = float(source_rect.width) * PT_TO_MM
            source_h_mm = float(source_rect.height) * PT_TO_MM
            paper_w_mm, paper_h_mm, cols, rows = _paper_geometry(
                source_w_mm,
                source_h_mm,
                paper_size,
                orientation,
                printer_margin_mm,
                overlap_mm,
            )
            if sheet_number + cols * rows > MAX_OUTPUT_SHEETS:
                raise ValueError(f"분할 결과가 {MAX_OUTPUT_SHEETS}장을 초과합니다. 더 큰 출력 용지를 선택하세요.")

            usable_w_mm = paper_w_mm - printer_margin_mm * 2
            usable_h_mm = paper_h_mm - printer_margin_mm * 2
            step_w_mm = usable_w_mm - overlap_mm
            step_h_mm = usable_h_mm - overlap_mm
            margin_pt = printer_margin_mm * MM_TO_PT

            for row in range(rows):
                for col in range(cols):
                    x0_mm = col * step_w_mm
                    y0_mm = row * step_h_mm
                    x1_mm = min(source_w_mm, x0_mm + usable_w_mm)
                    y1_mm = min(source_h_mm, y0_mm + usable_h_mm)
                    crop_w_mm = max(0.0, x1_mm - x0_mm)
                    crop_h_mm = max(0.0, y1_mm - y0_mm)
                    if crop_w_mm <= 0 or crop_h_mm <= 0:
                        continue

                    out_page = output.new_page(
                        width=paper_w_mm * MM_TO_PT,
                        height=paper_h_mm * MM_TO_PT,
                    )
                    clip = fitz.Rect(
                        source_rect.x0 + x0_mm * MM_TO_PT,
                        source_rect.y0 + y0_mm * MM_TO_PT,
                        source_rect.x0 + x1_mm * MM_TO_PT,
                        source_rect.y0 + y1_mm * MM_TO_PT,
                    )
                    target = fitz.Rect(
                        margin_pt,
                        margin_pt,
                        margin_pt + crop_w_mm * MM_TO_PT,
                        margin_pt + crop_h_mm * MM_TO_PT,
                    )
                    out_page.show_pdf_page(
                        target,
                        source,
                        page_index,
                        clip=clip,
                        keep_proportion=True,
                    )
                    sheet_number += 1
                    if add_sheet_labels:
                        _draw_sheet_label(
                            out_page,
                            f"P{page_index + 1} · {row + 1}-{col + 1} / {rows}x{cols}",
                            printer_margin_mm,
                        )

        if output.page_count < 1:
            raise ValueError("분할 결과 페이지가 없습니다.")

        buffer = io.BytesIO()
        output.save(
            buffer,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
        )
        return TilingResult(
            data=buffer.getvalue(),
            source_pages=source.page_count,
            sheet_count=output.page_count,
            paper_size=paper_size,
            printer_margin_mm=float(printer_margin_mm),
            overlap_mm=float(overlap_mm),
        )
    finally:
        output.close()
        source.close()
