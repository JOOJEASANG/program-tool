"""Print-production metadata checks for PDF preflight.

These checks are intentionally metadata-based. They do not claim to replace a
commercial RIP/preflight engine, but they surface two common production risks:
missing page boxes and missing/weak output intent metadata.
"""
from __future__ import annotations

import re

from models.schemas import CheckItem, CheckSeverity

PT_TO_MM = 25.4 / 72.0
BLEED_MM = 3.0
BLEED_TOLERANCE_MM = 0.25
_BOX_NUMBER_RE = re.compile(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)")
_XREF_RE = re.compile(r"(?<!\d)(\d+)\s+\d+\s+R\b")
_LITERAL_RE_TEMPLATE = r"/{key}\s*\(([^)]{{1,240}})\)"
_NAME_RE_TEMPLATE = r"/{key}\s*/([^\s<>\[\]()/%]{{1,120}})"


def _xref_value(doc, xref: int, key: str) -> tuple[str, str]:
    try:
        kind, value = doc.xref_get_key(xref, key)
        return str(kind or ""), str(value or "")
    except Exception:
        return "", ""


def _has_box_value(kind: str, value: str) -> bool:
    return bool(kind and kind.lower() not in {"null", "none"} and value and value != "null")


def _parse_box(value: str) -> tuple[float, float, float, float] | None:
    numbers = _BOX_NUMBER_RE.findall(value or "")
    if len(numbers) < 4:
        return None
    try:
        x0, y0, x1, y1 = (float(item) for item in numbers[:4])
    except ValueError:
        return None
    if x1 <= x0 or y1 <= y0:
        return None
    return x0, y0, x1, y1


def _bleed_is_sufficient(trim_box, bleed_box) -> bool:
    minimum_pt = max(0.0, (BLEED_MM - BLEED_TOLERANCE_MM) / PT_TO_MM)
    tx0, ty0, tx1, ty1 = trim_box
    bx0, by0, bx1, by1 = bleed_box
    return (
        tx0 - bx0 >= minimum_pt
        and ty0 - by0 >= minimum_pt
        and bx1 - tx1 >= minimum_pt
        and by1 - ty1 >= minimum_pt
    )


def check_page_boxes(doc, file_size_bytes: int | None = None) -> CheckItem:
    """Check for explicit TrimBox/BleedBox metadata and roughly 3 mm bleed."""
    del file_size_bytes
    total_pages = len(doc)
    if total_pages < 1:
        return CheckItem(
            id="page_boxes",
            label="재단·도련 박스",
            severity=CheckSeverity.warning,
            detail="페이지가 없어 TrimBox/BleedBox를 확인할 수 없습니다.",
        )

    missing_trim: list[int] = []
    missing_bleed: list[int] = []
    narrow_bleed: list[int] = []
    unreadable: list[int] = []

    for index in range(total_pages):
        page = doc[index]
        page_xref = int(getattr(page, "xref", 0) or 0)
        if page_xref <= 0:
            unreadable.append(index + 1)
            continue

        trim_kind, trim_value = _xref_value(doc, page_xref, "TrimBox")
        bleed_kind, bleed_value = _xref_value(doc, page_xref, "BleedBox")
        has_trim = _has_box_value(trim_kind, trim_value)
        has_bleed = _has_box_value(bleed_kind, bleed_value)

        if not has_trim:
            missing_trim.append(index + 1)
        if not has_bleed:
            missing_bleed.append(index + 1)
        if not (has_trim and has_bleed):
            continue

        trim_box = _parse_box(trim_value)
        bleed_box = _parse_box(bleed_value)
        if trim_box is None or bleed_box is None:
            unreadable.append(index + 1)
            continue
        if not _bleed_is_sufficient(trim_box, bleed_box):
            narrow_bleed.append(index + 1)

    affected = sorted(set(missing_trim + missing_bleed + narrow_bleed + unreadable))
    if affected:
        parts: list[str] = []
        if missing_trim:
            parts.append(f"TrimBox 미지정 {len(missing_trim)}p")
        if missing_bleed:
            parts.append(f"BleedBox 미지정 {len(missing_bleed)}p")
        if narrow_bleed:
            parts.append(f"약 {BLEED_MM:.0f}mm 도련 부족 {len(narrow_bleed)}p")
        if unreadable:
            parts.append(f"박스 정보 확인 불가 {len(unreadable)}p")
        return CheckItem(
            id="page_boxes",
            label="재단·도련 박스",
            severity=CheckSeverity.warning,
            detail=(
                ", ".join(parts)
                + ". 인쇄용 PDF라면 재단 기준(TrimBox)과 도련 영역(BleedBox)을 명확히 지정하는 것을 권장합니다."
            ),
            page_refs=affected[:100],
        )

    return CheckItem(
        id="page_boxes",
        label="재단·도련 박스",
        severity=CheckSeverity.pass_,
        detail=f"전체 {total_pages}페이지에 TrimBox/BleedBox가 있고 약 {BLEED_MM:.0f}mm 이상 도련이 확보되어 있습니다.",
    )


def _referenced_xrefs(value: str) -> set[int]:
    return {int(match.group(1)) for match in _XREF_RE.finditer(value or "")}


def _extract_pdf_token(objects: list[str], key: str) -> str:
    literal_re = re.compile(_LITERAL_RE_TEMPLATE.format(key=re.escape(key)))
    name_re = re.compile(_NAME_RE_TEMPLATE.format(key=re.escape(key)))
    for value in objects:
        match = literal_re.search(value)
        if match:
            return re.sub(r"\\([()\\])", r"\1", match.group(1)).strip()
        match = name_re.search(value)
        if match:
            return match.group(1).strip()
    return ""


def _output_intent_objects(doc) -> tuple[list[str], bool]:
    try:
        catalog_xref = int(doc.pdf_catalog())
    except Exception:
        return [], True
    if catalog_xref <= 0:
        return [], True

    kind, value = _xref_value(doc, catalog_xref, "OutputIntents")
    if not _has_box_value(kind, value):
        return [], False

    objects = [value]
    incomplete = False
    for xref in sorted(_referenced_xrefs(value)):
        try:
            objects.append(str(doc.xref_object(xref, compressed=False) or ""))
        except Exception:
            incomplete = True
    return objects, incomplete


def check_output_intent(doc, file_size_bytes: int | None = None) -> CheckItem:
    """Check output intent / ICC metadata used by print-oriented PDF workflows."""
    del file_size_bytes
    objects, incomplete = _output_intent_objects(doc)
    if not objects:
        if incomplete:
            return CheckItem(
                id="output_intent",
                label="출력 프로파일(ICC)",
                severity=CheckSeverity.warning,
                detail="PDF의 OutputIntent 정보를 읽지 못했습니다. 인쇄 전 출력 프로파일과 PDF/X 설정을 별도로 확인하세요.",
            )
        return CheckItem(
            id="output_intent",
            label="출력 프로파일(ICC)",
            severity=CheckSeverity.warning,
            detail="OutputIntent가 없습니다. 색상 관리가 중요한 인쇄물은 ICC 출력 프로파일 또는 PDF/X 설정을 포함하는 것을 권장합니다.",
        )

    joined = "\n".join(objects)
    has_profile = bool(re.search(r"/DestOutputProfile\s+\d+\s+\d+\s+R\b", joined))
    subtype = _extract_pdf_token(objects, "S")
    condition = (
        _extract_pdf_token(objects, "OutputConditionIdentifier")
        or _extract_pdf_token(objects, "OutputCondition")
        or _extract_pdf_token(objects, "Info")
    )
    is_pdfx = "GTS_PDFX" in joined or subtype.upper().startswith("GTS_PDFX")

    if not has_profile:
        suffix = f" ({condition})" if condition else ""
        return CheckItem(
            id="output_intent",
            label="출력 프로파일(ICC)",
            severity=CheckSeverity.warning,
            detail=f"OutputIntent는 있으나 연결된 ICC DestOutputProfile을 확인하지 못했습니다{suffix}. 인쇄소 출력 조건과 일치하는지 확인하세요.",
        )

    descriptor = condition or ("PDF/X OutputIntent" if is_pdfx else "ICC OutputIntent")
    note = " PDF/X 계열 출력 의도가 확인되었습니다." if is_pdfx else ""
    if incomplete:
        note += " 일부 참조 객체는 읽지 못했으므로 RIP에서 최종 확인을 권장합니다."
    return CheckItem(
        id="output_intent",
        label="출력 프로파일(ICC)",
        severity=CheckSeverity.pass_ if not incomplete else CheckSeverity.warning,
        detail=f"출력 프로파일이 연결되어 있습니다: {descriptor}.{note}".strip(),
    )


def run_print_metadata_checks(doc, file_size_bytes: int | None = None) -> list[CheckItem]:
    checks: list[CheckItem] = []
    for check, item_id, label in (
        (check_page_boxes, "page_boxes", "재단·도련 박스"),
        (check_output_intent, "output_intent", "출력 프로파일(ICC)"),
    ):
        try:
            checks.append(check(doc, file_size_bytes))
        except Exception as exc:
            checks.append(
                CheckItem(
                    id=item_id,
                    label=label,
                    severity=CheckSeverity.warning,
                    detail=f"검사 실행 중 오류로 건너뜀: {type(exc).__name__}: {str(exc)[:120]}",
                )
            )
    return checks
