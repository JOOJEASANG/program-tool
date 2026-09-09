from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

import fitz

MM_TO_PT = 72.0 / 25.4
EPS = 1e-7


@dataclass(frozen=True)
class SourceItem:
    file_index: int
    name: str
    width_mm: float
    height_mm: float
    page_count: int
    quantity: int


@dataclass(frozen=True)
class Placement:
    file_index: int
    copy_index: int
    x_mm: float
    y_mm: float
    width_mm: float
    height_mm: float
    rotated: bool


@dataclass
class LayoutPlan:
    paper_width_mm: float
    paper_height_mm: float
    duplex: bool
    flip_edge: str
    sheets: list[list[Placement]] = field(default_factory=list)
    source_items: list[SourceItem] = field(default_factory=list)

    @property
    def total_copies(self) -> int:
        return sum(item.quantity for item in self.source_items)

    @property
    def utilization(self) -> float:
        if not self.sheets:
            return 0.0
        used = sum(item.width_mm * item.height_mm * item.quantity for item in self.source_items)
        total = len(self.sheets) * self.paper_width_mm * self.paper_height_mm
        return min(100.0, max(0.0, used / total * 100.0 if total else 0.0))


@dataclass(frozen=True)
class _Rect:
    x: float
    y: float
    width: float
    height: float

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def bottom(self) -> float:
        return self.y + self.height


def _intersects(a: _Rect, b: _Rect) -> bool:
    return not (
        b.x >= a.right - EPS
        or b.right <= a.x + EPS
        or b.y >= a.bottom - EPS
        or b.bottom <= a.y + EPS
    )


class _MaxRectsBin:
    def __init__(self, width: float, height: float):
        self.width = width
        self.height = height
        self.free: list[_Rect] = [_Rect(0.0, 0.0, width, height)]

    def candidate(self, width: float, height: float, allow_rotate: bool):
        options = [(width, height, False)]
        if allow_rotate and abs(width - height) > EPS:
            options.append((height, width, True))
        best = None
        for free_rect in self.free:
            for use_w, use_h, rotated in options:
                if use_w > free_rect.width + EPS or use_h > free_rect.height + EPS:
                    continue
                leftover_w = free_rect.width - use_w
                leftover_h = free_rect.height - use_h
                score = (
                    min(leftover_w, leftover_h),
                    max(leftover_w, leftover_h),
                    free_rect.width * free_rect.height - use_w * use_h,
                    free_rect.y,
                    free_rect.x,
                    1 if rotated else 0,
                )
                candidate = (score, _Rect(free_rect.x, free_rect.y, use_w, use_h), rotated)
                if best is None or candidate[0] < best[0]:
                    best = candidate
        return best

    def place(self, used: _Rect) -> None:
        next_free: list[_Rect] = []
        for free_rect in self.free:
            if not _intersects(free_rect, used):
                next_free.append(free_rect)
                continue

            if used.x < free_rect.right and used.right > free_rect.x:
                if used.y > free_rect.y + EPS:
                    next_free.append(_Rect(free_rect.x, free_rect.y, free_rect.width, used.y - free_rect.y))
                if used.bottom < free_rect.bottom - EPS:
                    next_free.append(_Rect(free_rect.x, used.bottom, free_rect.width, free_rect.bottom - used.bottom))

            if used.y < free_rect.bottom and used.bottom > free_rect.y:
                if used.x > free_rect.x + EPS:
                    next_free.append(_Rect(free_rect.x, free_rect.y, used.x - free_rect.x, free_rect.height))
                if used.right < free_rect.right - EPS:
                    next_free.append(_Rect(used.right, free_rect.y, free_rect.right - used.right, free_rect.height))

        self.free = _prune_rectangles(next_free)


def _contains(outer: _Rect, inner: _Rect) -> bool:
    return (
        inner.x >= outer.x - EPS
        and inner.y >= outer.y - EPS
        and inner.right <= outer.right + EPS
        and inner.bottom <= outer.bottom + EPS
    )


def _prune_rectangles(rectangles: Iterable[_Rect]) -> list[_Rect]:
    raw = [rect for rect in rectangles if rect.width > EPS and rect.height > EPS]
    result: list[_Rect] = []
    for index, rect in enumerate(raw):
        if any(index != other_index and _contains(other, rect) for other_index, other in enumerate(raw)):
            continue
        result.append(rect)
    return result


def _page_size_mm(page: fitz.Page) -> tuple[float, float]:
    rect = page.rect
    return rect.width / MM_TO_PT, rect.height / MM_TO_PT


def _resolve_duplex(source_items: list[SourceItem], side_mode: str) -> bool:
    if side_mode == 'single':
        return False
    if side_mode == 'duplex':
        return True
    return any(item.page_count >= 2 for item in source_items)


def inspect_sources(docs: list[fitz.Document], jobs, filenames: list[str], side_mode: str) -> tuple[list[SourceItem], bool]:
    items: list[SourceItem] = []
    for job in jobs:
        if job.file_index < 0 or job.file_index >= len(docs):
            raise ValueError('파일 작업 정보가 올바르지 않습니다')
        doc = docs[job.file_index]
        if doc.page_count < 1:
            raise ValueError('페이지가 없는 PDF는 배치할 수 없습니다')
        if doc.page_count > 2:
            raise ValueError('스마트 인쇄배치는 파일별 1~2페이지 PDF를 지원합니다. 1페이지는 앞면, 2페이지는 앞면·뒷면으로 사용합니다.')
        width_mm, height_mm = _page_size_mm(doc[0])
        if doc.page_count == 2:
            back_w, back_h = _page_size_mm(doc[1])
            if abs(back_w - width_mm) > 0.8 or abs(back_h - height_mm) > 0.8:
                raise ValueError(f'{filenames[job.file_index]}의 앞면과 뒷면 크기가 다릅니다')
        items.append(SourceItem(
            file_index=job.file_index,
            name=filenames[job.file_index],
            width_mm=width_mm,
            height_mm=height_mm,
            page_count=doc.page_count,
            quantity=job.quantity,
        ))
    duplex = _resolve_duplex(items, side_mode)
    if side_mode == 'single' and any(item.page_count > 1 for item in items):
        raise ValueError('2페이지 PDF가 포함되어 있습니다. 앞면·뒷면 자동배치를 사용하려면 양면 또는 자동 모드를 선택해 주세요.')
    return items, duplex


def build_layout_plan(source_items: list[SourceItem], paper_width_mm: float, paper_height_mm: float, margin_mm: float, gap_mm: float, allow_rotate: bool, duplex: bool, flip_edge: str) -> LayoutPlan:
    usable_width = paper_width_mm - 2 * margin_mm + gap_mm
    usable_height = paper_height_mm - 2 * margin_mm + gap_mm
    if usable_width <= 1 or usable_height <= 1:
        raise ValueError('용지 여백이 너무 큽니다')

    expanded: list[tuple[SourceItem, int]] = []
    for item in source_items:
        if min(item.width_mm, item.height_mm) <= 1:
            raise ValueError(f'{item.name}의 페이지 크기를 확인할 수 없습니다')
        if not (
            (item.width_mm + gap_mm <= usable_width + EPS and item.height_mm + gap_mm <= usable_height + EPS)
            or (allow_rotate and item.height_mm + gap_mm <= usable_width + EPS and item.width_mm + gap_mm <= usable_height + EPS)
        ):
            raise ValueError(f'{item.name} ({item.width_mm:.1f}×{item.height_mm:.1f}mm)이 선택한 용지에 들어가지 않습니다')
        for copy_index in range(item.quantity):
            expanded.append((item, copy_index))

    expanded.sort(key=lambda pair: (-max(pair[0].width_mm, pair[0].height_mm), -(pair[0].width_mm * pair[0].height_mm), pair[0].file_index, pair[1]))

    bins: list[_MaxRectsBin] = []
    sheets: list[list[Placement]] = []
    for item, copy_index in expanded:
        req_w = item.width_mm + gap_mm
        req_h = item.height_mm + gap_mm
        best = None
        for sheet_index, bin_ in enumerate(bins):
            candidate = bin_.candidate(req_w, req_h, allow_rotate)
            if candidate is None:
                continue
            ranked = (candidate[0], sheet_index, candidate)
            if best is None or ranked[0:2] < best[0:2]:
                best = ranked

        if best is None:
            bin_ = _MaxRectsBin(usable_width, usable_height)
            candidate = bin_.candidate(req_w, req_h, allow_rotate)
            if candidate is None:
                raise ValueError(f'{item.name}을 선택한 용지에 배치할 수 없습니다')
            sheet_index = len(bins)
            bins.append(bin_)
            sheets.append([])
        else:
            _, sheet_index, candidate = best
            bin_ = bins[sheet_index]

        _, used, rotated = candidate
        bin_.place(used)
        placed_w = used.width - gap_mm
        placed_h = used.height - gap_mm
        sheets[sheet_index].append(Placement(
            file_index=item.file_index,
            copy_index=copy_index,
            x_mm=margin_mm + used.x,
            y_mm=margin_mm + used.y,
            width_mm=placed_w,
            height_mm=placed_h,
            rotated=rotated,
        ))

    return LayoutPlan(
        paper_width_mm=paper_width_mm,
        paper_height_mm=paper_height_mm,
        duplex=duplex,
        flip_edge=flip_edge,
        sheets=sheets,
        source_items=source_items,
    )


def mirror_back_placement(placement: Placement, paper_width_mm: float, paper_height_mm: float, flip_edge: str) -> Placement:
    portrait_or_square = paper_height_mm >= paper_width_mm
    mirror_x = (flip_edge == 'long' and portrait_or_square) or (flip_edge == 'short' and not portrait_or_square)
    if mirror_x:
        x_mm = paper_width_mm - placement.x_mm - placement.width_mm
        y_mm = placement.y_mm
    else:
        x_mm = placement.x_mm
        y_mm = paper_height_mm - placement.y_mm - placement.height_mm
    return Placement(
        file_index=placement.file_index,
        copy_index=placement.copy_index,
        x_mm=x_mm,
        y_mm=y_mm,
        width_mm=placement.width_mm,
        height_mm=placement.height_mm,
        rotated=placement.rotated,
    )


def _placement_rect_pt(placement: Placement) -> fitz.Rect:
    return fitz.Rect(
        placement.x_mm * MM_TO_PT,
        placement.y_mm * MM_TO_PT,
        (placement.x_mm + placement.width_mm) * MM_TO_PT,
        (placement.y_mm + placement.height_mm) * MM_TO_PT,
    )


def _draw_crop_marks(page: fitz.Page, placement: Placement, gap_mm: float) -> None:
    if gap_mm < 1.0:
        return
    rect = _placement_rect_pt(placement)
    offset = min(1.0, gap_mm * 0.25) * MM_TO_PT
    length = min(3.0, max(1.5, gap_mm * 0.75)) * MM_TO_PT
    width = 0.35
    color = (0, 0, 0)
    page.draw_line((rect.x0 - offset - length, rect.y0), (rect.x0 - offset, rect.y0), color=color, width=width)
    page.draw_line((rect.x0, rect.y0 - offset - length), (rect.x0, rect.y0 - offset), color=color, width=width)
    page.draw_line((rect.x1 + offset, rect.y0), (rect.x1 + offset + length, rect.y0), color=color, width=width)
    page.draw_line((rect.x1, rect.y0 - offset - length), (rect.x1, rect.y0 - offset), color=color, width=width)
    page.draw_line((rect.x0 - offset - length, rect.y1), (rect.x0 - offset, rect.y1), color=color, width=width)
    page.draw_line((rect.x0, rect.y1 + offset), (rect.x0, rect.y1 + offset + length), color=color, width=width)
    page.draw_line((rect.x1 + offset, rect.y1), (rect.x1 + offset + length, rect.y1), color=color, width=width)
    page.draw_line((rect.x1, rect.y1 + offset), (rect.x1, rect.y1 + offset + length), color=color, width=width)


def render_layout_pdf(docs: list[fitz.Document], plan: LayoutPlan, *, gap_mm: float, crop_marks: bool) -> bytes:
    output = fitz.open()
    width_pt = plan.paper_width_mm * MM_TO_PT
    height_pt = plan.paper_height_mm * MM_TO_PT
    try:
        for sheet in plan.sheets:
            front = output.new_page(width=width_pt, height=height_pt)
            for placement in sheet:
                rect = _placement_rect_pt(placement)
                front.show_pdf_page(rect, docs[placement.file_index], 0, keep_proportion=False, rotate=90 if placement.rotated else 0)
                if crop_marks:
                    _draw_crop_marks(front, placement, gap_mm)

            if plan.duplex:
                back = output.new_page(width=width_pt, height=height_pt)
                for placement in sheet:
                    doc = docs[placement.file_index]
                    back_placement = mirror_back_placement(placement, plan.paper_width_mm, plan.paper_height_mm, plan.flip_edge)
                    if doc.page_count >= 2:
                        rect = _placement_rect_pt(back_placement)
                        back.show_pdf_page(rect, doc, 1, keep_proportion=False, rotate=90 if placement.rotated else 0)
                    if crop_marks:
                        _draw_crop_marks(back, back_placement, gap_mm)
        return output.tobytes(garbage=4, deflate=True, clean=True)
    finally:
        output.close()
