"""Reliability post-processing for preflight results.

Sampled checks must never be presented as a full-document pass.
"""
from __future__ import annotations

import re

from models.schemas import CheckItem, CheckSeverity
from services.preflight_geometry import run_geometry_checks
from services.preflight_svc import run_all_checks


SAMPLED_RANGE_RE = re.compile(
    r"앞\s+\d+\s*페이지\s*검사,\s*전체\s+\d+\s*p",
    re.IGNORECASE,
)
PARTIAL_WARNING = (
    "검사한 페이지 범위에서만 문제가 발견되지 않았으며 "
    "전체 문서 통과를 의미하지 않습니다."
)


def mark_sampled_pass_as_warning(item: CheckItem) -> CheckItem:
    """Downgrade sampled pass results while preserving actual findings."""
    if item.severity != CheckSeverity.pass_:
        return item

    detail = str(item.detail or "")
    if not SAMPLED_RANGE_RE.search(detail):
        return item

    if PARTIAL_WARNING not in detail:
        detail = f"{detail.rstrip()} {PARTIAL_WARNING}".strip()

    return item.model_copy(
        update={
            "severity": CheckSeverity.warning,
            "detail": detail,
        }
    )


def run_reliable_checks(doc, file_size_bytes: int | None = None) -> list[CheckItem]:
    """Run normal checks and replace the legacy text-only bleed heuristic."""
    checks = [
        item
        for item in run_all_checks(doc, file_size_bytes)
        if item.id != "bleed"
    ]
    checks.extend(run_geometry_checks(doc, file_size_bytes))
    return [mark_sampled_pass_as_warning(item) for item in checks]
