"""Advanced print-production checks for PDF preflight.

The checks in this module deliberately stay conservative. They inspect explicit
PDF color-space/resource metadata and decoded page content operators, but they do
not rasterize embedded images or pretend to replace a RIP. Results therefore
state their scope and downgrade incomplete/sampled inspections to warnings.
"""
from __future__ import annotations

import re

from models.schemas import CheckItem, CheckSeverity

MAX_ANALYSIS_PAGES = 100
HEAVY_ANALYSIS_PAGES = 24
HUGE_ANALYSIS_PAGES = 8
HEAVY_PDF_BYTES = 50 * 1024 * 1024
HUGE_PDF_BYTES = 120 * 1024 * 1024
MAX_RESOURCE_OBJECTS_PER_PAGE = 1024
TAC_WARNING_PERCENT = 300.0

_XREF_RE = re.compile(r"(?<!\d)(\d+)\s+\d+\s+R\b")
_RESOURCE_NAME_REF_RE = re.compile(
    r"/([^\s<>\[\]()/%]+)\s+(\d+)\s+\d+\s+R\b"
)
_SEPARATION_RE = re.compile(r"/Separation\s+/([^\s<>\[\]()/%]+)")
_DEVICEN_RE = re.compile(r"/DeviceN\s*\[([^\]]{1,4000})\]", re.DOTALL)
_NAME_RE = re.compile(r"/([^\s<>\[\]()/%]+)")
_OVERPRINT_RE = re.compile(r"/(?:OP|op)\s+true\b")
_INLINE_EXTGSTATE_RE = re.compile(
    r"/([^\s<>\[\]()/%]+)\s*<<(?:(?!>>).){0,1600}?/(?:OP|op)\s+true\b(?:(?!>>).){0,1600}?>>",
    re.DOTALL,
)
_GS_USE_RE = re.compile(rb"/([^\s<>\[\]()/%]+)\s+gs\b")
_NUMBER_BYTES = rb"[-+]?(?:\d+(?:\.\d*)?|\.\d+)"
_CMYK_OPERATOR_RE = re.compile(
    rb"(?<![A-Za-z0-9_.])(" + _NUMBER_BYTES + rb")\s+"
    rb"(" + _NUMBER_BYTES + rb")\s+"
    rb"(" + _NUMBER_BYTES + rb")\s+"
    rb"(" + _NUMBER_BYTES + rb")\s+([kK])(?=\s|$)"
)
_STANDARD_PROCESS_NAMES = {"cyan", "magenta", "yellow", "black", "none", "all"}


def _check_limit(total_pages: int, file_size_bytes: int | None) -> tuple[int, bool]:
    if file_size_bytes and file_size_bytes >= HUGE_PDF_BYTES:
        limit = min(total_pages, HUGE_ANALYSIS_PAGES)
    elif file_size_bytes and file_size_bytes >= HEAVY_PDF_BYTES:
        limit = min(total_pages, HEAVY_ANALYSIS_PAGES)
    else:
        limit = min(total_pages, MAX_ANALYSIS_PAGES)
    return limit, total_pages > limit


def _sample_note(total_pages: int, limit: int, sampled: bool) -> str:
    if not sampled:
        return ""
    return f" (앞 {limit}페이지 검사, 전체 {total_pages}p)"


def _xref_value(doc, xref: int, key: str) -> tuple[str, str]:
    try:
        kind, value = doc.xref_get_key(xref, key)
        return str(kind or ""), str(value or "")
    except Exception:
        return "", ""


def _has_value(kind: str, value: str) -> bool:
    return bool(kind and kind.lower() not in {"null", "none"} and value and value != "null")


def _referenced_xrefs(value: str) -> set[int]:
    return {int(match.group(1)) for match in _XREF_RE.finditer(value or "")}


def _page_resource_value(doc, page) -> tuple[str, bool]:
    """Return page resources, following inherited page-tree resources when needed."""
    current = int(getattr(page, "xref", 0) or 0)
    visited: set[int] = set()
    incomplete = False
    for _ in range(10):
        if current <= 0 or current in visited:
            break
        visited.add(current)
        kind, value = _xref_value(doc, current, "Resources")
        if _has_value(kind, value):
            return value, incomplete
        parent_kind, parent_value = _xref_value(doc, current, "Parent")
        parents = sorted(_referenced_xrefs(parent_value)) if _has_value(parent_kind, parent_value) else []
        if not parents:
            break
        current = parents[0]
    return "", True


def _page_resource_objects(doc, page) -> tuple[list[str], bool]:
    root_value, incomplete = _page_resource_value(doc, page)
    if not root_value:
        return [], incomplete

    objects = [root_value]
    pending = list(_referenced_xrefs(root_value))
    inspected: set[int] = set()
    while pending:
        xref = pending.pop()
        if xref <= 0 or xref in inspected:
            continue
        if len(inspected) >= MAX_RESOURCE_OBJECTS_PER_PAGE:
            incomplete = True
            break
        inspected.add(xref)
        try:
            value = str(doc.xref_object(xref, compressed=False) or "")
        except Exception:
            incomplete = True
            continue
        objects.append(value)
        pending.extend(_referenced_xrefs(value) - inspected)
    return objects, incomplete


def _page_content_streams(doc, page) -> tuple[list[bytes], bool]:
    streams: list[bytes] = []
    incomplete = False
    try:
        xrefs = page.get_contents() or []
    except Exception:
        return streams, True
    for xref in xrefs:
        try:
            streams.append(bytes(doc.xref_stream(xref) or b""))
        except Exception:
            incomplete = True
    return streams, incomplete


def _decode_pdf_name(value: str | bytes) -> str:
    if isinstance(value, bytes):
        text = value.decode("latin-1", errors="replace")
    else:
        text = str(value or "")

    def replace(match: re.Match[str]) -> str:
        try:
            return bytes([int(match.group(1), 16)]).decode("latin-1")
        except Exception:
            return match.group(0)

    return re.sub(r"#([0-9A-Fa-f]{2})", replace, text).strip()


def _spot_names(objects: list[str]) -> set[str]:
    names: set[str] = set()
    for value in objects:
        for match in _SEPARATION_RE.finditer(value):
            name = _decode_pdf_name(match.group(1))
            if name and name.lower() not in _STANDARD_PROCESS_NAMES:
                names.add(name)
        for match in _DEVICEN_RE.finditer(value):
            for name_match in _NAME_RE.finditer(match.group(1)):
                name = _decode_pdf_name(name_match.group(1))
                if name and name.lower() not in _STANDARD_PROCESS_NAMES:
                    names.add(name)
    return names


def _overprint_resource_names(doc, objects: list[str]) -> set[str]:
    names: set[str] = set()
    inspected_targets: dict[int, bool] = {}
    for value in objects:
        for inline in _INLINE_EXTGSTATE_RE.finditer(value):
            names.add(inline.group(1))
        for match in _RESOURCE_NAME_REF_RE.finditer(value):
            raw_name = match.group(1)
            xref = int(match.group(2))
            if xref not in inspected_targets:
                try:
                    target = str(doc.xref_object(xref, compressed=False) or "")
                    inspected_targets[xref] = bool(_OVERPRINT_RE.search(target))
                except Exception:
                    inspected_targets[xref] = False
            if inspected_targets[xref]:
                names.add(raw_name)
    return names


def _used_graphics_states(streams: list[bytes]) -> set[str]:
    used: set[str] = set()
    for stream in streams:
        for match in _GS_USE_RE.finditer(stream):
            used.add(match.group(1).decode("latin-1", errors="replace"))
    return used


def _strip_pdf_strings_and_comments(stream: bytes) -> bytes:
    """Blank literals/comments so text contents do not look like CMYK operators."""
    data = bytearray(stream)
    index = 0
    length = len(data)
    while index < length:
        byte = data[index]
        if byte == 0x25:  # % comment
            index += 1
            while index < length and data[index] not in (0x0A, 0x0D):
                data[index] = 0x20
                index += 1
            continue
        if byte == 0x28:  # ( literal string )
            data[index] = 0x20
            index += 1
            depth = 1
            while index < length and depth:
                current = data[index]
                data[index] = 0x20
                if current == 0x5C:  # escaped byte
                    index += 1
                    if index < length:
                        data[index] = 0x20
                elif current == 0x28:
                    depth += 1
                elif current == 0x29:
                    depth -= 1
                index += 1
            continue
        if byte == 0x3C and index + 1 < length and data[index + 1] != 0x3C:  # <hex string>
            data[index] = 0x20
            index += 1
            while index < length:
                current = data[index]
                data[index] = 0x20
                index += 1
                if current == 0x3E:
                    break
            continue
        index += 1
    return bytes(data)


def _cmyk_values(streams: list[bytes]):
    for stream in streams:
        clean = _strip_pdf_strings_and_comments(stream)
        for match in _CMYK_OPERATOR_RE.finditer(clean):
            try:
                values = tuple(float(match.group(i)) for i in range(1, 5))
            except Exception:
                continue
            if any(value < 0.0 or value > 1.0 for value in values):
                continue
            yield values, match.group(5).decode("ascii")


def check_spot_colors(doc, file_size_bytes: int | None = None) -> CheckItem:
    total_pages = len(doc)
    limit, sampled = _check_limit(total_pages, file_size_bytes)
    pages: list[int] = []
    names: set[str] = set()
    incomplete = False

    for index in range(limit):
        objects, partial = _page_resource_objects(doc, doc[index])
        incomplete = incomplete or partial
        found = _spot_names(objects)
        if found:
            pages.append(index + 1)
            names.update(found)

    note = _sample_note(total_pages, limit, sampled)
    if names:
        display = ", ".join(sorted(names)[:8])
        if len(names) > 8:
            display += f" 외 {len(names) - 8}개"
        detail = (
            f"별색(Separation/DeviceN)이 {len(pages)}페이지에서 확인되었습니다: {display}. "
            "의도한 별색·후가공판인지, 인쇄소에서 해당 판을 출력할지 확인하세요."
        )
        if incomplete:
            detail += " 일부 리소스는 완전히 읽지 못했습니다."
        return CheckItem(
            id="spot_colors",
            label="별색(Spot Color)",
            severity=CheckSeverity.warning,
            detail=detail + note,
            page_refs=pages[:100],
        )
    if incomplete:
        return CheckItem(
            id="spot_colors",
            label="별색(Spot Color)",
            severity=CheckSeverity.warning,
            detail="일부 페이지 리소스를 완전히 읽지 못해 별색 검사를 부분 수행했습니다." + note,
        )
    return CheckItem(
        id="spot_colors",
        label="별색(Spot Color)",
        severity=CheckSeverity.pass_,
        detail="명시된 Separation/DeviceN 별색 정의가 발견되지 않았습니다." + note,
    )


def check_overprint(doc, file_size_bytes: int | None = None) -> CheckItem:
    total_pages = len(doc)
    limit, sampled = _check_limit(total_pages, file_size_bytes)
    pages: list[int] = []
    state_names: set[str] = set()
    incomplete = False

    for index in range(limit):
        page = doc[index]
        objects, resource_partial = _page_resource_objects(doc, page)
        streams, content_partial = _page_content_streams(doc, page)
        incomplete = incomplete or resource_partial or content_partial
        candidates = _overprint_resource_names(doc, objects)
        used = _used_graphics_states(streams)
        active = candidates & used
        if active:
            pages.append(index + 1)
            state_names.update(_decode_pdf_name(name) for name in active)

    note = _sample_note(total_pages, limit, sampled)
    if pages:
        states = ", ".join(sorted(name for name in state_names if name)[:6])
        suffix = f" (그래픽 상태: {states})" if states else ""
        detail = (
            f"실제로 사용된 Overprint 그래픽 상태가 {len(pages)}페이지에서 확인되었습니다{suffix}. "
            "검정 오버프린트나 별색 겹침이 의도한 출력인지 RIP/분판 미리보기에서 확인하세요."
        )
        if incomplete:
            detail += " 일부 리소스 또는 콘텐츠 스트림은 완전히 읽지 못했습니다."
        return CheckItem(
            id="overprint",
            label="오버프린트",
            severity=CheckSeverity.warning,
            detail=detail + note,
            page_refs=pages[:100],
        )
    if incomplete:
        return CheckItem(
            id="overprint",
            label="오버프린트",
            severity=CheckSeverity.warning,
            detail="일부 페이지의 그래픽 상태를 완전히 읽지 못해 오버프린트 검사를 부분 수행했습니다." + note,
        )
    return CheckItem(
        id="overprint",
        label="오버프린트",
        severity=CheckSeverity.pass_,
        detail="사용 중인 그래픽 상태에서 명시적 Overprint 설정이 발견되지 않았습니다." + note,
    )


def _scan_explicit_cmyk(doc, file_size_bytes: int | None):
    total_pages = len(doc)
    limit, sampled = _check_limit(total_pages, file_size_bytes)
    incomplete = False
    pure_k_pages: set[int] = set()
    rich_black_pages: set[int] = set()
    high_tac_pages: set[int] = set()
    cmyk_pages: set[int] = set()
    max_tac = 0.0

    for index in range(limit):
        streams, partial = _page_content_streams(doc, doc[index])
        incomplete = incomplete or partial
        for (cyan, magenta, yellow, black), _operator in _cmyk_values(streams):
            page_number = index + 1
            cmyk_pages.add(page_number)
            tac = (cyan + magenta + yellow + black) * 100.0
            max_tac = max(max_tac, tac)
            if tac > TAC_WARNING_PERCENT + 0.01:
                high_tac_pages.add(page_number)
            if black >= 0.95 and max(cyan, magenta, yellow) <= 0.02:
                pure_k_pages.add(page_number)
            elif black >= 0.80 and max(cyan, magenta, yellow) >= 0.05:
                rich_black_pages.add(page_number)

    return {
        "total_pages": total_pages,
        "limit": limit,
        "sampled": sampled,
        "incomplete": incomplete,
        "pure_k_pages": sorted(pure_k_pages),
        "rich_black_pages": sorted(rich_black_pages),
        "high_tac_pages": sorted(high_tac_pages),
        "cmyk_pages": sorted(cmyk_pages),
        "max_tac": max_tac,
    }


def check_black_ink(doc, file_size_bytes: int | None = None) -> CheckItem:
    result = _scan_explicit_cmyk(doc, file_size_bytes)
    note = _sample_note(result["total_pages"], result["limit"], result["sampled"])
    rich_pages = result["rich_black_pages"]
    pure_pages = result["pure_k_pages"]

    if rich_pages:
        detail = (
            f"명시 CMYK 연산자 기준 Rich Black 조합이 {len(rich_pages)}페이지에서 확인되었습니다. "
            "큰 검정 면에는 사용할 수 있지만 작은 글자·가는 선에 적용되면 맞물림 오차가 보일 수 있으므로 확인하세요."
        )
        if pure_pages:
            detail += f" 순수 100K 검정도 {len(pure_pages)}페이지에서 확인되었습니다."
        if result["incomplete"]:
            detail += " 일부 콘텐츠 스트림은 완전히 읽지 못했습니다."
        return CheckItem(
            id="black_ink",
            label="검정판(100K/Rich Black)",
            severity=CheckSeverity.warning,
            detail=detail + note,
            page_refs=rich_pages[:100],
        )

    if result["incomplete"]:
        return CheckItem(
            id="black_ink",
            label="검정판(100K/Rich Black)",
            severity=CheckSeverity.warning,
            detail="일부 콘텐츠 스트림을 읽지 못해 검정판 검사를 부분 수행했습니다." + note,
        )

    if pure_pages:
        return CheckItem(
            id="black_ink",
            label="검정판(100K/Rich Black)",
            severity=CheckSeverity.pass_,
            detail=f"명시 CMYK 연산자 기준 Rich Black 위험 조합은 없고 순수 100K 검정이 {len(pure_pages)}페이지에서 확인되었습니다." + note,
        )

    return CheckItem(
        id="black_ink",
        label="검정판(100K/Rich Black)",
        severity=CheckSeverity.pass_,
        detail="명시 CMYK 연산자에서 Rich Black 또는 순수 100K 검정 사용이 확인되지 않았습니다. 이미지 내부 픽셀은 이 검사 범위에 포함되지 않습니다." + note,
    )


def check_total_ink_coverage(doc, file_size_bytes: int | None = None) -> CheckItem:
    result = _scan_explicit_cmyk(doc, file_size_bytes)
    note = _sample_note(result["total_pages"], result["limit"], result["sampled"])
    high_pages = result["high_tac_pages"]
    max_tac = float(result["max_tac"])

    if high_pages:
        detail = (
            f"명시 DeviceCMYK 연산자 기준 총잉크량(TAC)이 {TAC_WARNING_PERCENT:.0f}%를 넘는 값이 "
            f"{len(high_pages)}페이지에서 확인되었습니다. 최대 약 {max_tac:.0f}%입니다. "
            "실제 허용 TAC는 용지·인쇄 조건에 따라 다르므로 인쇄소 기준과 비교하세요."
        )
        if result["incomplete"]:
            detail += " 일부 콘텐츠 스트림은 완전히 읽지 못했습니다."
        return CheckItem(
            id="total_ink_coverage",
            label="총잉크량(TAC)",
            severity=CheckSeverity.warning,
            detail=detail + note,
            page_refs=high_pages[:100],
        )

    if result["incomplete"]:
        return CheckItem(
            id="total_ink_coverage",
            label="총잉크량(TAC)",
            severity=CheckSeverity.warning,
            detail="일부 콘텐츠 스트림을 읽지 못해 TAC 검사를 부분 수행했습니다. 이미지 내부 픽셀 TAC는 별도 RIP 검수가 필요합니다." + note,
        )

    if result["cmyk_pages"]:
        return CheckItem(
            id="total_ink_coverage",
            label="총잉크량(TAC)",
            severity=CheckSeverity.pass_,
            detail=f"명시 DeviceCMYK 연산자 기준 {TAC_WARNING_PERCENT:.0f}% 초과 TAC가 발견되지 않았습니다. 최대 약 {max_tac:.0f}%이며 이미지 내부 픽셀은 검사 범위에 포함되지 않습니다." + note,
        )

    return CheckItem(
        id="total_ink_coverage",
        label="총잉크량(TAC)",
        severity=CheckSeverity.pass_,
        detail="명시 DeviceCMYK k/K 연산자가 없어 벡터·텍스트 TAC 경고가 없습니다. 임베디드 이미지와 ICC 변환 후 TAC는 RIP에서 별도 확인해야 합니다." + note,
    )


def run_advanced_print_checks(doc, file_size_bytes: int | None = None) -> list[CheckItem]:
    checks: list[CheckItem] = []
    for check, item_id, label in (
        (check_spot_colors, "spot_colors", "별색(Spot Color)"),
        (check_overprint, "overprint", "오버프린트"),
        (check_black_ink, "black_ink", "검정판(100K/Rich Black)"),
        (check_total_ink_coverage, "total_ink_coverage", "총잉크량(TAC)"),
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
