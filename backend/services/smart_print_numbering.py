from __future__ import annotations

from dataclasses import dataclass, replace

import fitz

from services.smart_print_layout import LayoutPlan, Placement, mirror_back_placement

MM_TO_PT = 72.0 / 25.4
MAX_NUMBERED_COPIES = 2000
_ALLOWED_FORMATS = {'plain', 'pad3', 'no-pad3'}
_ALLOWED_POSITIONS = {
    'top-left', 'top-center', 'top-right',
    'bottom-left', 'bottom-center', 'bottom-right',
}
_FONT_NAMES = {
    'korean': 'korea',
    'helvetica': 'helv',
    'helvetica-bold': 'hebo',
    'helvetica-oblique': 'heit',
    'helvetica-bold-oblique': 'hebi',
    'times': 'tiro',
    'times-bold': 'tibo',
    'times-italic': 'tiit',
    'times-bold-italic': 'tibi',
    'courier': 'cour',
    'courier-bold': 'cobo',
    'courier-oblique': 'coit',
    'courier-bold-oblique': 'cobi',
}


@dataclass(frozen=True)
class NumberingOptions:
    enabled: bool = False
    start: int = 1
    end: int | None = None
    format: str = 'pad3'
    position: str = 'bottom-right'
    font_size_pt: float = 9.0
    font: str = 'helvetica-bold'
    prefix: str = ''
    transparent_background: bool = False
    margin_x_mm: float = 1.6
    margin_y_mm: float = 1.6


def parse_numbering_options(raw) -> NumberingOptions:
    if not isinstance(raw, dict) or not raw.get('enabled'):
        return NumberingOptions(enabled=False)
    try:
        start = int(raw.get('start', 1))
        end_raw = raw.get('end')
        end = None if end_raw in (None, '') else int(end_raw)
        font_size = float(raw.get('font_size_pt', 9.0))
        margin_x = float(raw.get('margin_x_mm', 1.6))
        margin_y = float(raw.get('margin_y_mm', 1.6))
    except (TypeError, ValueError) as exc:
        raise ValueError('넘버링 시작·끝번호, 글자 크기와 여백을 확인해 주세요') from exc
    fmt = str(raw.get('format') or 'pad3').strip().lower()
    position = str(raw.get('position') or 'bottom-right').strip().lower()
    font = str(raw.get('font') or 'helvetica-bold').strip().lower()
    prefix = str(raw.get('prefix') or '').strip()
    transparent_background = bool(raw.get('transparent_background'))
    if start < 0 or start > 9_999_999:
        raise ValueError('넘버링 시작번호는 0~9,999,999 범위로 입력해 주세요')
    if end is not None:
        if end < start:
            raise ValueError('넘버링 끝번호는 시작번호보다 크거나 같아야 합니다')
        if end > 9_999_999:
            raise ValueError('넘버링 끝번호는 9,999,999 이하로 입력해 주세요')
        if end - start + 1 > MAX_NUMBERED_COPIES:
            raise ValueError(f'한 번에 생성할 넘버링은 최대 {MAX_NUMBERED_COPIES:,}개까지 가능합니다')
    if fmt not in _ALLOWED_FORMATS:
        raise ValueError('넘버링 표시 형식을 확인해 주세요')
    if position not in _ALLOWED_POSITIONS:
        raise ValueError('넘버링 위치를 확인해 주세요')
    if font not in _FONT_NAMES:
        raise ValueError('넘버링 글꼴을 확인해 주세요')
    if len(prefix) > 40 or any(ord(char) < 32 for char in prefix):
        raise ValueError('넘버링 앞 문구는 줄바꿈 없이 40자 이하로 입력해 주세요')
    if font_size < 5 or font_size > 36:
        raise ValueError('넘버링 글자 크기는 5~36pt 범위로 입력해 주세요')
    if not 0 <= margin_x <= 50 or not 0 <= margin_y <= 50:
        raise ValueError('넘버링 여백은 0~50mm 범위로 입력해 주세요')
    return NumberingOptions(
        enabled=True,
        start=start,
        end=end,
        format=fmt,
        position=position,
        font_size_pt=font_size,
        font=font,
        prefix=prefix,
        transparent_background=transparent_background,
        margin_x_mm=margin_x,
        margin_y_mm=margin_y,
    )


def format_number(value: int, fmt: str, prefix: str = '') -> str:
    if fmt == 'plain':
        number = str(value)
    elif fmt == 'no-pad3':
        number = f'NO.{value:03d}'
    else:
        number = f'{value:03d}'
    normalized_prefix = str(prefix or '').strip()
    return f'{normalized_prefix} {number}' if normalized_prefix else number


def _contains_korean(text: str) -> bool:
    """Return True when text contains Hangul that base PDF fonts cannot encode safely."""
    for char in str(text or ''):
        code = ord(char)
        if (
            0x1100 <= code <= 0x11FF
            or 0x3130 <= code <= 0x318F
            or 0xA960 <= code <= 0xA97F
            or 0xAC00 <= code <= 0xD7A3
            or 0xD7B0 <= code <= 0xD7FF
        ):
            return True
    return False


def _resolved_font_name(options: NumberingOptions, label: str) -> str:
    # Browser preview can fall back to a system Korean font automatically, while
    # PyMuPDF's Latin base fonts cannot. Keep Latin font choices for Latin-only
    # labels but force the built-in CJK font whenever the rendered label has Hangul.
    if _contains_korean(label):
        return 'korea'
    return _FONT_NAMES[options.font]


def expand_layout_for_numbering(plan: LayoutPlan, raw_options) -> LayoutPlan:
    """Repeat auto-fill sheet templates until the requested numbering range is exhausted.

    The existing auto-fill planner intentionally creates one full sheet per source file. Numbered
    jobs need physical pages rather than printer-side sheet copies, so a requested end number turns
    those sheets into templates. The final sheet is truncated to the exact remaining number count.
    """
    options = parse_numbering_options(raw_options)
    if not options.enabled or options.end is None:
        return plan

    requested = options.end - options.start + 1
    templates = [sheet for sheet in plan.sheets if sheet]
    if not templates:
        raise ValueError('넘버링을 생성할 배치 면이 없습니다')

    expanded: list[list[Placement]] = []
    file_copy_counts: dict[int, int] = {}
    produced = 0
    template_index = 0
    while produced < requested:
        template = templates[template_index % len(templates)]
        remaining = requested - produced
        next_sheet: list[Placement] = []
        for placement in template[:remaining]:
            copy_index = file_copy_counts.get(placement.file_index, 0)
            next_sheet.append(replace(placement, copy_index=copy_index))
            file_copy_counts[placement.file_index] = copy_index + 1
            produced += 1
        if not next_sheet:
            raise ValueError('넘버링 범위를 생성할 배치 항목이 없습니다')
        expanded.append(next_sheet)
        template_index += 1

    resolved_items = [
        replace(item, quantity=file_copy_counts.get(item.file_index, 0))
        for item in plan.source_items
    ]
    return LayoutPlan(
        paper_width_mm=plan.paper_width_mm,
        paper_height_mm=plan.paper_height_mm,
        duplex=plan.duplex,
        flip_edge=plan.flip_edge,
        sheets=expanded,
        source_items=resolved_items,
    )


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
    font_name = _resolved_font_name(options, label)
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
    if not options.transparent_background:
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
            if options.end is not None and sequence > options.end:
                break
            label_count = len(sheet)
            if options.end is not None:
                label_count = min(label_count, options.end - sequence + 1)
            labels = [format_number(sequence + index, options.format, options.prefix) for index in range(label_count)]
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
            sequence += len(labels)
        return document.tobytes(garbage=4, deflate=True, clean=True)
    finally:
        document.close()
