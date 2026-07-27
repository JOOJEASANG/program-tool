"""Geometry-aware print checks for trim, bleed, and safe text margins."""
from __future__ import annotations

import fitz

from models.schemas import CheckItem, CheckSeverity

PT_PER_MM = 72 / 25.4
REQUIRED_BLEED_PT = 3.0 * PT_PER_MM
SAFE_TEXT_PT = 3.0 * PT_PER_MM
MAX_GEOMETRY_CHECK_PAGES = 200
BOX_TOLERANCE_PT = 0.75


def _rect_close(a: fitz.Rect, b: fitz.Rect, tolerance: float = BOX_TOLERANCE_PT) -> bool:
    return (
        abs(a.x0 - b.x0) <= tolerance
        and abs(a.y0 - b.y0) <= tolerance
        and abs(a.x1 - b.x1) <= tolerance
        and abs(a.y1 - b.y1) <= tolerance
    )


def _page_box(page: fitz.Page, name: str, fallback: fitz.Rect) -> fitz.Rect:
    try:
        value = getattr(page, name)
        return fitz.Rect(value)
    except Exception:
        return fitz.Rect(fallback)


def _bleed_distances(trim: fitz.Rect, bleed: fitz.Rect) -> tuple[float, float, float, float]:
    return (
        trim.x0 - bleed.x0,
        trim.y0 - bleed.y0,
        bleed.x1 - trim.x1,
        bleed.y1 - trim.y1,
    )


def check_bleed_boxes(doc: fitz.Document, file_size_bytes: int | None = None) -> CheckItem:
    """Verify explicit TrimBox/BleedBox geometry instead of guessing from text."""
    insufficient: list[int] = []
    missing: list[int] = []
    unreadable: list[int] = []
    limit = min(len(doc), MAX_GEOMETRY_CHECK_PAGES)

    for page_index in range(limit):
        try:
            page = doc[page_index]
            media = _page_box(page, "mediabox", page.rect)
            trim = _page_box(page, "trimbox", media)
            bleed = _page_box(page, "bleedbox", media)
            explicit_trim = not _rect_close(trim, media)
            explicit_bleed = not _rect_close(bleed, media) or explicit_trim
            if not explicit_trim or not explicit_bleed:
                missing.append(page_index + 1)
                continue
            distances = _bleed_distances(trim, bleed)
            if any(distance + BOX_TOLERANCE_PT < REQUIRED_BLEED_PT for distance in distances):
                insufficient.append(page_index + 1)
        except Exception:
            unreadable.append(page_index + 1)

    sampled = len(doc) > limit
    sample_note = f" (앞 {limit}페이지 검사, 전체 {len(doc)}p)" if sampled else ""
    if insufficient:
        return CheckItem(
            id="bleed",
            label="도련 영역",
            severity=CheckSeverity.warning,
            detail=(
                f"{len(insufficient)}페이지의 BleedBox가 TrimBox 바깥 3mm를 확보하지 못했습니다. "
                f"배경·이미지를 도련선까지 연장했는지 확인하세요.{sample_note}"
            ),
            page_refs=insufficient[:50],
        )
    if missing:
        return CheckItem(
            id="bleed",
            label="도련 영역",
            severity=CheckSeverity.warning,
            detail=(
                f"{len(missing)}페이지에 명시적인 TrimBox/BleedBox가 없어 도련 3mm를 자동 확인할 수 없습니다. "
                f"인쇄소 규격에 맞는 페이지 박스를 설정하거나 출력 전 육안 확인하세요.{sample_note}"
            ),
            page_refs=missing[:50],
        )
    if unreadable:
        return CheckItem(
            id="bleed",
            label="도련 영역",
            severity=CheckSeverity.warning,
            detail=f"일부 페이지의 페이지 박스를 읽지 못해 도련 검사를 부분 수행했습니다.{sample_note}",
            page_refs=unreadable[:50],
        )
    return CheckItem(
        id="bleed",
        label="도련 영역",
        severity=CheckSeverity.pass_,
        detail=f"검사한 모든 페이지의 TrimBox/BleedBox에 3mm 이상 도련이 설정되어 있습니다.{sample_note}",
    )


def check_text_safe_margin(doc: fitz.Document, file_size_bytes: int | None = None) -> CheckItem:
    """Warn when text enters the 3mm safe area inside the trim boundary."""
    unsafe_pages: list[int] = []
    unreadable: list[int] = []
    limit = min(len(doc), MAX_GEOMETRY_CHECK_PAGES)

    for page_index in range(limit):
        try:
            page = doc[page_index]
            media = _page_box(page, "mediabox", page.rect)
            trim = _page_box(page, "trimbox", media)
            safe = fitz.Rect(
                trim.x0 + SAFE_TEXT_PT,
                trim.y0 + SAFE_TEXT_PT,
                trim.x1 - SAFE_TEXT_PT,
                trim.y1 - SAFE_TEXT_PT,
            )
            if safe.width <= 0 or safe.height <= 0:
                unsafe_pages.append(page_index + 1)
                continue
            for block in page.get_text("blocks") or []:
                block_rect = fitz.Rect(block[:4])
                if not safe.contains(block_rect):
                    unsafe_pages.append(page_index + 1)
                    break
        except Exception:
            unreadable.append(page_index + 1)

    sampled = len(doc) > limit
    sample_note = f" (앞 {limit}페이지 검사, 전체 {len(doc)}p)" if sampled else ""
    if unsafe_pages:
        return CheckItem(
            id="safe_margin",
            label="텍스트 안전 여백",
            severity=CheckSeverity.warning,
            detail=(
                f"{len(unsafe_pages)}페이지의 텍스트가 재단선 안쪽 3mm 안전 영역을 벗어났습니다. "
                f"중요 문구가 잘리지 않도록 안쪽으로 이동하세요.{sample_note}"
            ),
            page_refs=unsafe_pages[:50],
        )
    if unreadable:
        return CheckItem(
            id="safe_margin",
            label="텍스트 안전 여백",
            severity=CheckSeverity.warning,
            detail=f"일부 페이지의 텍스트 위치를 읽지 못해 안전 여백 검사를 부분 수행했습니다.{sample_note}",
            page_refs=unreadable[:50],
        )
    return CheckItem(
        id="safe_margin",
        label="텍스트 안전 여백",
        severity=CheckSeverity.pass_,
        detail=f"검사한 모든 텍스트가 재단선 안쪽 3mm 안전 영역에 있습니다.{sample_note}",
    )


def run_geometry_checks(
    doc: fitz.Document, file_size_bytes: int | None = None
) -> list[CheckItem]:
    return [
        check_bleed_boxes(doc, file_size_bytes),
        check_text_safe_margin(doc, file_size_bytes),
    ]
