"""Make sampled preflight results explicit instead of reporting a full pass."""
from __future__ import annotations

import re

from models.schemas import CheckItem, CheckSeverity
from services import preflight_svc


SAMPLED_RANGE_RE = re.compile(r"앞\s+\d+\s*페이지\s*검사,\s*전체\s+\d+\s*p", re.IGNORECASE)
PARTIAL_WARNING = "검사한 페이지 범위에서만 문제가 발견되지 않았으며 전체 문서 통과를 의미하지 않습니다."


def _mark_partial(item: CheckItem) -> CheckItem:
    """Downgrade sampled pass results to warning while preserving real findings."""
    if item.severity != CheckSeverity.pass_:
        return item

    detail = str(item.detail or "")
    if not SAMPLED_RANGE_RE.search(detail):
        return item

    if PARTIAL_WARNING not in detail:
        detail = f"{detail.rstrip()} {PARTIAL_WARNING}".strip()

    return item.model_copy(update={
        "severity": CheckSeverity.warning,
        "detail": detail,
    })


_original_run_all_checks = preflight_svc.run_all_checks


def _run_all_checks_reliable(doc, file_size_bytes: int | None = None) -> list[CheckItem]:
    checks = _original_run_all_checks(doc, file_size_bytes)
    return [_mark_partial(item) for item in checks]


if not getattr(preflight_svc, "_sampled_results_patch_v1", False):
    preflight_svc.run_all_checks = _run_all_checks_reliable
    preflight_svc._sampled_results_patch_v1 = True
