"""Make sampled preflight results explicit instead of reporting a full pass."""
from __future__ import annotations

from models.schemas import CheckItem, CheckSeverity
from services import preflight_svc


_PATCHED_IDS = {"dpi", "bleed", "color_mode", "font_embed", "transparency"}
_SAMPLE_MARKERS = ("앞 ", "대용량 PDF 빠른검수", "부분 검수", "부분 수행")


def _is_sampled(item: CheckItem) -> bool:
    detail = str(item.detail or "")
    return item.id in _PATCHED_IDS and any(marker in detail for marker in _SAMPLE_MARKERS)


def _mark_partial(item: CheckItem) -> CheckItem:
    if item.severity != CheckSeverity.pass_ or not _is_sampled(item):
        return item
    return item.model_copy(update={
        "severity": CheckSeverity.warning,
        "detail": "검사한 범위에서는 문제가 발견되지 않았습니다. 전체 문서 통과를 의미하지 않습니다. "
                  + str(item.detail or ""),
    })


if not getattr(preflight_svc, "_sample_result_patch_v1", False):
    _original_run_all_checks = preflight_svc.run_all_checks

    def run_all_checks_with_partial_status(doc, file_size_bytes=None):
        return [_mark_partial(item) for item in _original_run_all_checks(doc, file_size_bytes)]

    preflight_svc.run_all_checks = run_all_checks_with_partial_status
    preflight_svc._sample_result_patch_v1 = True
