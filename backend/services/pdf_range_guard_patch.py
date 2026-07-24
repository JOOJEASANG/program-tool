"""Bound PDF header/footer page-range parsing before iteration."""
from __future__ import annotations

import re

from services import pdf_ops

MAX_RANGE_SPEC_LENGTH = 4096
MAX_RANGE_TOKENS = 512
MAX_ENDPOINT_DIGITS = 12


def parse_page_ranges_guarded(spec: str, total_pages: int) -> set[int]:
    total = max(0, int(total_pages or 0))
    if total == 0:
        return set()
    raw = str(spec or "").strip()
    if not raw:
        return set(range(1, total + 1))
    if len(raw) > MAX_RANGE_SPEC_LENGTH:
        raise ValueError("페이지 범위 입력이 너무 깁니다.")

    chunks = [chunk for chunk in re.split(r"[,\s]+", raw) if chunk]
    if len(chunks) > MAX_RANGE_TOKENS:
        raise ValueError("페이지 범위 항목이 너무 많습니다.")

    pages: set[int] = set()
    for chunk in chunks:
        match = re.fullmatch(r"(\d+)\s*-\s*(\d+)", chunk)
        if match:
            left_raw, right_raw = match.groups()
            if len(left_raw) > MAX_ENDPOINT_DIGITS or len(right_raw) > MAX_ENDPOINT_DIGITS:
                continue
            left, right = int(left_raw), int(right_raw)
            start = max(1, min(left, right))
            end = min(total, max(left, right))
            if start <= end:
                pages.update(range(start, end + 1))
            continue

        if not chunk.isdigit() or len(chunk) > MAX_ENDPOINT_DIGITS:
            continue
        page = int(chunk)
        if 1 <= page <= total:
            pages.add(page)
    return pages


pdf_ops._parse_page_ranges = parse_page_ranges_guarded
pdf_ops._page_range_guard_v1 = True
