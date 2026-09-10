from __future__ import annotations

from dataclasses import replace

from services.smart_print_layout import EPS, LayoutPlan, Placement, SourceItem, _MaxRectsBin


MAX_AUTO_PLACEMENTS = 2000


def _center_sheet(
    placements: list[Placement],
    paper_width_mm: float,
    paper_height_mm: float,
) -> list[Placement]:
    """Center the actual artwork bounding box on the physical sheet."""
    if not placements:
        return placements

    min_x = min(p.x_mm for p in placements)
    min_y = min(p.y_mm for p in placements)
    max_x = max(p.x_mm + p.width_mm for p in placements)
    max_y = max(p.y_mm + p.height_mm for p in placements)
    group_width = max_x - min_x
    group_height = max_y - min_y
    dx = (paper_width_mm - group_width) / 2.0 - min_x
    dy = (paper_height_mm - group_height) / 2.0 - min_y

    return [replace(p, x_mm=p.x_mm + dx, y_mm=p.y_mm + dy) for p in placements]


def _fits_source(
    item: SourceItem,
    usable_width: float,
    usable_height: float,
    gap_mm: float,
    allow_rotate: bool,
) -> bool:
    if min(item.width_mm, item.height_mm) <= 1:
        return False
    normal = (
        item.width_mm + gap_mm <= usable_width + EPS
        and item.height_mm + gap_mm <= usable_height + EPS
    )
    rotated = (
        allow_rotate
        and item.height_mm + gap_mm <= usable_width + EPS
        and item.width_mm + gap_mm <= usable_height + EPS
    )
    return normal or rotated


def build_auto_fill_layout_plan(
    source_items: list[SourceItem],
    paper_width_mm: float,
    paper_height_mm: float,
    margin_mm: float,
    gap_mm: float,
    allow_rotate: bool,
    duplex: bool,
    flip_edge: str,
) -> LayoutPlan:
    """Fill one centered sheet per uploaded PDF with as many copies as fit.

    Quantity is intentionally not user-driven in this mode. Each source PDF gets
    one physical sheet so the final number of sheet copies can be chosen in the
    printer dialog without rebuilding the imposition.
    """
    if not source_items:
        raise ValueError("배치할 PDF가 없습니다.")
    if paper_width_mm <= 0 or paper_height_mm <= 0:
        raise ValueError("용지 크기가 올바르지 않습니다.")
    if margin_mm < 0 or gap_mm < 0:
        raise ValueError("여백과 간격은 0 이상이어야 합니다.")

    usable_width = paper_width_mm - 2.0 * margin_mm + gap_mm
    usable_height = paper_height_mm - 2.0 * margin_mm + gap_mm
    if usable_width <= 1 or usable_height <= 1:
        raise ValueError("용지 여백이 너무 큽니다.")

    sheets: list[list[Placement]] = []
    resolved_items: list[SourceItem] = []
    total_placements = 0

    for item in source_items:
        if not _fits_source(item, usable_width, usable_height, gap_mm, allow_rotate):
            raise ValueError(
                f"{item.name} ({item.width_mm:.1f}×{item.height_mm:.1f}mm)이 선택한 용지에 들어가지 않습니다."
            )

        remaining = MAX_AUTO_PLACEMENTS - total_placements
        if remaining <= 0:
            raise ValueError(
                f"자동 배치 결과가 {MAX_AUTO_PLACEMENTS:,}개를 초과합니다. 파일 수나 용지 설정을 조정해 주세요."
            )

        bin_state = _MaxRectsBin(usable_width, usable_height)
        placements: list[Placement] = []
        request_width = item.width_mm + gap_mm
        request_height = item.height_mm + gap_mm

        for copy_index in range(remaining):
            candidate = bin_state.candidate(request_width, request_height, allow_rotate)
            if candidate is None:
                break
            _, used, rotated = candidate
            bin_state.place(used)
            placements.append(
                Placement(
                    file_index=item.file_index,
                    copy_index=copy_index,
                    x_mm=margin_mm + used.x,
                    y_mm=margin_mm + used.y,
                    width_mm=used.width - gap_mm,
                    height_mm=used.height - gap_mm,
                    rotated=rotated,
                )
            )

        if not placements:
            raise ValueError(f"{item.name}을 배치할 수 없습니다.")
        if len(placements) == remaining and bin_state.candidate(request_width, request_height, allow_rotate):
            raise ValueError(
                f"자동 배치 결과가 {MAX_AUTO_PLACEMENTS:,}개를 초과합니다. 파일 수나 용지 설정을 조정해 주세요."
            )

        centered = _center_sheet(placements, paper_width_mm, paper_height_mm)
        total_placements += len(centered)
        sheets.append(centered)
        resolved_items.append(replace(item, quantity=len(centered)))

    return LayoutPlan(
        paper_width_mm=paper_width_mm,
        paper_height_mm=paper_height_mm,
        duplex=duplex,
        flip_edge=flip_edge,
        sheets=sheets,
        source_items=resolved_items,
    )
