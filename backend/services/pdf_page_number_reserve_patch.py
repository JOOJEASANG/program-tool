"""Ensure page-number auto-reserve includes the actual edge anchor and full text height."""
from __future__ import annotations

from services import pdf_individual_margin_patch as margin_patch
from services import pdf_ops


def _required_space(settings, paper_edge_pt: float) -> float:
    margin_mm = getattr(settings, "margin_mm", None)
    dedicated = pdf_ops._mm_to_pt_safe(margin_mm, 5.0) if margin_mm is not None else pdf_ops.PN_MARGIN_PT
    anchor = max(paper_edge_pt, dedicated)
    font_size = max(6.0, min(72.0, float(getattr(settings, "font_size", 10.0) or 10.0)))
    return min(80.0 * pdf_ops.MM_TO_PT, anchor + font_size * 1.8 + 2.0 * pdf_ops.MM_TO_PT)


def _resolve_layout_margins(request, output_page_idx: int) -> tuple[float, float, float, float]:
    left, right, top, bottom = margin_patch._base_layout_margins(request, output_page_idx)
    settings = request.page_numbers
    if bool(getattr(settings, "auto_reserve_space", True)) and margin_patch._page_number_applies(settings, output_page_idx):
        position = str(getattr(settings, "position", "bottom-center"))
        if position.startswith("top-"):
            top = max(top, _required_space(settings, top))
        else:
            bottom = max(bottom, _required_space(settings, bottom))
    return left, right, top, bottom


margin_patch._resolve_layout_margins = _resolve_layout_margins
