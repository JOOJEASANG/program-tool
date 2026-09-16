from __future__ import annotations

import fitz

from services.smart_print_layout import LayoutPlan, Placement, mirror_back_placement


MM_TO_PT = 72.0 / 25.4


def parse_trim_size(raw_settings: dict, *, required: bool = False) -> tuple[float | None, float | None]:
    raw_width = raw_settings.get('trim_width_mm')
    raw_height = raw_settings.get('trim_height_mm')
    if raw_width in (None, '') and raw_height in (None, ''):
        if required:
            raise ValueError('재단크기는 필수입력입니다. 재단 가로와 세로를 입력해 주세요.')
        return None, None
    if raw_width in (None, '') or raw_height in (None, ''):
        raise ValueError('재단 가로와 세로를 모두 입력해 주세요.')
    try:
        width_mm = float(raw_width)
        height_mm = float(raw_height)
    except (TypeError, ValueError) as exc:
        raise ValueError('재단크기 입력값을 확인해 주세요.') from exc
    if not 2.0 <= width_mm <= 2000.0 or not 2.0 <= height_mm <= 2000.0:
        raise ValueError('재단크기는 가로·세로 각각 2~2,000mm 범위로 입력해 주세요.')
    return width_mm, height_mm


def trim_rect_mm(
    placement: Placement,
    trim_width_mm: float,
    trim_height_mm: float,
) -> tuple[float, float, float, float]:
    use_width = trim_height_mm if placement.rotated else trim_width_mm
    use_height = trim_width_mm if placement.rotated else trim_height_mm
    x0 = placement.x_mm + (placement.width_mm - use_width) / 2.0
    y0 = placement.y_mm + (placement.height_mm - use_height) / 2.0
    return x0, y0, x0 + use_width, y0 + use_height


def _draw_trim_marks(
    page: fitz.Page,
    placement: Placement,
    gap_mm: float,
    trim_width_mm: float,
    trim_height_mm: float,
) -> None:
    x0_mm, y0_mm, x1_mm, y1_mm = trim_rect_mm(placement, trim_width_mm, trim_height_mm)
    x0 = x0_mm * MM_TO_PT
    y0 = y0_mm * MM_TO_PT
    x1 = x1_mm * MM_TO_PT
    y1 = y1_mm * MM_TO_PT

    # The mark length still respects the layout gap, while the mark position is
    # always anchored to the user-entered finished trim size rather than the
    # uploaded PDF/image page edge.
    offset = min(1.0, max(0.5, gap_mm * 0.25)) * MM_TO_PT
    length = min(3.0, max(1.5, gap_mm * 0.75)) * MM_TO_PT
    width = 0.35
    color = (0, 0, 0)

    page.draw_line((x0 - offset - length, y0), (x0 - offset, y0), color=color, width=width)
    page.draw_line((x0, y0 - offset - length), (x0, y0 - offset), color=color, width=width)
    page.draw_line((x1 + offset, y0), (x1 + offset + length, y0), color=color, width=width)
    page.draw_line((x1, y0 - offset - length), (x1, y0 - offset), color=color, width=width)
    page.draw_line((x0 - offset - length, y1), (x0 - offset, y1), color=color, width=width)
    page.draw_line((x0, y1 + offset), (x0, y1 + offset + length), color=color, width=width)
    page.draw_line((x1 + offset, y1), (x1 + offset + length, y1), color=color, width=width)
    page.draw_line((x1, y1 + offset), (x1, y1 + offset + length), color=color, width=width)


def apply_trim_crop_marks(
    pdf_bytes: bytes,
    plan: LayoutPlan,
    *,
    enabled: bool,
    gap_mm: float,
    trim_width_mm: float | None,
    trim_height_mm: float | None,
) -> bytes:
    if not enabled:
        return pdf_bytes
    if trim_width_mm is None or trim_height_mm is None:
        raise ValueError('완성 PDF에 재단표시를 추가하려면 재단 가로와 세로를 입력해 주세요.')

    output = fitz.open(stream=pdf_bytes, filetype='pdf')
    try:
        page_index = 0
        for sheet in plan.sheets:
            front = output[page_index]
            page_index += 1
            for placement in sheet:
                _draw_trim_marks(front, placement, gap_mm, trim_width_mm, trim_height_mm)

            if plan.duplex:
                back = output[page_index]
                page_index += 1
                for placement in sheet:
                    back_placement = mirror_back_placement(
                        placement,
                        plan.paper_width_mm,
                        plan.paper_height_mm,
                        plan.flip_edge,
                    )
                    _draw_trim_marks(back, back_placement, gap_mm, trim_width_mm, trim_height_mm)

        return output.tobytes(garbage=4, deflate=True, clean=True)
    finally:
        output.close()
