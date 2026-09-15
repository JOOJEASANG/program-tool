from __future__ import annotations

from dataclasses import dataclass

import fitz

from services.smart_print_layout import LayoutPlan, Placement, mirror_back_placement

MM_TO_PT = 72.0 / 25.4
_ALLOWED_FORMATS = {'plain', 'pad3', 'no-pad3'}
_ALLOWED_POSITIONS = {
    'top-left', 'top-center', 'top-right',
    'bottom-left', 'bottom-center', 'bottom-right',
}
_FONT_NAMES = {
    'helvetica': 'helv',
    'helvetica-bold': 'hebo',
    'times': 'tiro',
    'courier': 'cour',
}


@dataclass(frozen=True)
class NumberingOptions:
    enabled: bool = False
    start: int = 1
    format: str = 'pad3'
    position: str = 'bottom-right'
    font_size_pt: float = 9.0
    font: str = 'helvetica-bold'
    margin_x_mm: float = 1.6
    margin_y_mm: float = 1.6


def parse_numbering_options(raw) -> NumberingOptions:
    if not isinstance(raw, dict) or not raw.get('enabled'):
        return NumberingOptions(enabled=False)
    try:
        start = int(raw.get('start', 1))
        font_size = float(raw.get('font_size_pt', 9.0))
        margin_x = float(raw.get('margin_x_mm', 1.6))
        margin_y = float(raw.get('margin_y_mm', 1.6))
    except (TypeError, ValueError) as exc:
        raise ValueError('넘버링 시작번호, 글자 크기와 여백을 확인해 주세요') from exc
    fmt = str(raw.get('format') or 'pad3').strip().lower()
    position = str(raw.get('position') or 'bottom-right').strip().lower()
    font = str(raw.get('font') or 'helvetica-bold').strip().lower()
    if start < 0 or start > 9_999_999:
        raise ValueError('넘버링 시작번호는 0~9,999,999 범위로 입력해 주세요')
    if fmt not in _ALLOWED_FORMATS:
        raise ValueError('넘버링 표시 형식을 확인해 주세요')
    if position not in _ALLOWED_POSITIONS:
        raise ValueError('넘버링 위치를 확인해 주세요')
    if font not in _FONT_NAMES:
        raise ValueError('넘버링 글꼴을 확인해 주세요')
    if font_size < 5 or font_size > 36:
        raise ValueError('넘버링 글자 크기는 5~36pt 범위로 입력해 주세요')
    if not 0 <= margin_x <= 50 or not 0 <= margin_y <= 50:
        raise ValueError('넘버링 여백은 0~50mm 범위로 입력해 주세요')
    return NumberingOptions(True, start, fmt, position, font_size, font, margin_x, margin_y)


def format_number(value: int, fmt: str) -> str:
    if fmt == 'plain':
        return str(value)
    if fmt == 'no-pad3':
        return f'NO.{value:03d}'
    return f'{value:03d}'


def _placement_rect(placement: Placement) -> fitz.Rect:
    return fitz.Rect(
        placement.x_mm * MM_TO_PT,
        placement.y_mm * MM_TO_PT,
        (placement.x_mm + placement.width_mm) * MM_TO_PT,
        (placement.y_mm + placement.height_mm) * MM_TO_PT,
    )


def _draw_number(page: fitz.Page, placement: Placement, label: str, options: NumberingOptions) -> None:
    rect = _placement_rect(placement)
    inset_x = options.margin_x_mm * MM_TO_PT
    inset_y = options.margin_y_mm * MM_TO_PT
    pad_x = 1.0 * MM_TO_PT
    pad_y = 0.55 * MM_TO_PT
    font_name = _FONT_NAMES[options.font]
    font_size = options.font_size_pt
    base_width = max(1.0, fitz.get_text_length(label, fontname=font_name, fontsize=font_size))
    available_width = max(6.0, rect.width - 2 * inset_x - 2 * pad_x)
    available_height = max(6.0, rect.height - 2 * inset_y - 2 * pad_y)
    if base_width > available_width:
        font_size = max(4.0, font_size * available_width / base_width)
    font_size = min(font_size, max(4.0, available_height * 0.62))
    text_width = fitz.get_text_length(label, fontname=font_name, fontsize=font_size)
    box_width = text_width + 2 * pad_x
    box_height = font_size + 2 * pad_y

    if options.position.endswith('right'):
        x0 = rect.x1 - inset_x - box_width
    elif options.position.endswith('center'):
        x0 = rect.x0 + (rect.width - box_width) / 2
    else:
        x0 = rect.x0 + inset_x
    if options.position.startswith('top'):
        y0 = rect.y0 + inset_y
    else:
        y0 = rect.y1 - inset_y - box_height

    x0 = min(max(rect.x0, x0), max(rect.x0, rect.x1 - box_width))
    y0 = min(max(rect.y0, y0), max(rect.y0, rect.y1 - box_height))
    box = fitz.Rect(x0, y0, x0 + box_width, y0 + box_height)
    page.draw_rect(box, color=None, fill=(1, 1, 1), fill_opacity=0.82, overlay=True)
    page.insert_text(
        (box.x0 + pad_x, box.y0 + pad_y + font_size * 0.82),
        label,
        fontname=font_name,
        fontsize=font_size,
        color=(0, 0, 0),
        overlay=True,
    )


def apply_layout_numbering(pdf_bytes: bytes, plan: LayoutPlan, raw_options) -> bytes:
    options = parse_numbering_options(raw_options)
    if not options.enabled:
        return pdf_bytes

    document = fitz.open(stream=pdf_bytes, filetype='pdf')
    try:
        page_index = 0
        sequence = options.start
        for sheet in plan.sheets:
            labels = [format_number(sequence + index, options.format) for index in range(len(sheet))]
            if page_index >= document.page_count:
                raise ValueError('넘버링을 적용할 출력 페이지를 찾을 수 없습니다')
            front = document[page_index]
            for placement, label in zip(sheet, labels):
                _draw_number(front, placement, label, options)

            if plan.duplex:
                if page_index + 1 >= document.page_count:
                    raise ValueError('양면 넘버링을 적용할 뒷면 페이지를 찾을 수 없습니다')
                back = document[page_index + 1]
                for placement, label in zip(sheet, labels):
                    mirrored = mirror_back_placement(
                        placement,
                        plan.paper_width_mm,
                        plan.paper_height_mm,
                        plan.flip_edge,
                    )
                    _draw_number(back, mirrored, label, options)
                page_index += 2
            else:
                page_index += 1
            sequence += len(sheet)
        return document.tobytes(garbage=4, deflate=True, clean=True)
    finally:
        document.close()
