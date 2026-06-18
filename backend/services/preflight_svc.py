"""
Pre-flight PDF checks: DPI, bleed, color mode, font embedding, page size consistency.
"""
import fitz
from models.schemas import CheckItem, CheckSeverity

PT_TO_MM = 25.4 / 72
BLEED_MM = 3.0
MIN_DPI_PASS = 300
MIN_DPI_WARN = 150

# Image-heavy checks must stay bounded. Some 20-page PDFs can be 90MB+ when they
# contain huge images, transparency, effects, or malformed resources.
MAX_IMAGE_CHECK_PAGES = 50
HEAVY_IMAGE_CHECK_PAGES = 8
HUGE_IMAGE_CHECK_PAGES = 4
MAX_TEXT_CHECK_PAGES = 200
HEAVY_PDF_BYTES = 50 * 1024 * 1024
HUGE_PDF_BYTES = 120 * 1024 * 1024
HEAVY_AVG_PAGE_BYTES = 3 * 1024 * 1024

STANDARD_SIZES_PT = {
    "A4":  (595.28, 841.89),
    "A3":  (841.89, 1190.55),
    "A5":  (419.53, 595.28),
    "Letter": (612.0, 792.0),
    "B5":  (498.90, 708.66),
}
SIZE_TOLERANCE_PT = 3.0


def _size_label(w: float, h: float) -> str:
    for name, (sw, sh) in STANDARD_SIZES_PT.items():
        if abs(w - sw) < SIZE_TOLERANCE_PT and abs(h - sh) < SIZE_TOLERANCE_PT:
            return name
        if abs(w - sh) < SIZE_TOLERANCE_PT and abs(h - sw) < SIZE_TOLERANCE_PT:
            return f"{name} (가로)"
    return f"{w * PT_TO_MM:.0f}×{h * PT_TO_MM:.0f}mm"


def _is_heavy_pdf(doc: fitz.Document, file_size_bytes: int | None = None) -> bool:
    if not file_size_bytes:
        return False
    page_count = max(1, len(doc))
    return file_size_bytes >= HEAVY_PDF_BYTES or (file_size_bytes / page_count) >= HEAVY_AVG_PAGE_BYTES


def _is_huge_pdf(doc: fitz.Document, file_size_bytes: int | None = None) -> bool:
    return bool(file_size_bytes and file_size_bytes >= HUGE_PDF_BYTES)


def _image_check_limit(doc: fitz.Document, file_size_bytes: int | None = None) -> tuple[int, bool, bool]:
    total_pages = len(doc)
    heavy = _is_heavy_pdf(doc, file_size_bytes)
    huge = _is_huge_pdf(doc, file_size_bytes)
    if huge:
        limit = min(total_pages, HUGE_IMAGE_CHECK_PAGES)
    elif heavy:
        limit = min(total_pages, HEAVY_IMAGE_CHECK_PAGES)
    else:
        limit = min(total_pages, MAX_IMAGE_CHECK_PAGES)
    sampled = total_pages > limit
    return limit, sampled, heavy


def _sample_note(total_pages: int, check_limit: int, sampled: bool, heavy: bool = False) -> str:
    if not sampled and not heavy:
        return ""
    parts: list[str] = []
    if sampled:
        parts.append(f"앞 {check_limit}페이지 검사, 전체 {total_pages}p")
    if heavy:
        parts.append("대용량 PDF 빠른검수")
    return " (" + ", ".join(parts) + ")"


def _safe_page_image_info(page: fitz.Page) -> list[dict]:
    """Return image placement metadata without extracting full image streams."""
    try:
        return page.get_image_info(hashes=False, xrefs=True) or []
    except TypeError:
        try:
            return page.get_image_info(hashes=False) or []
        except TypeError:
            try:
                return page.get_image_info() or []
            except Exception:
                return []
        except Exception:
            return []
    except Exception:
        return []


def _info_effective_dpi(info: dict) -> float | None:
    try:
        pix_w = float(info.get("width") or 0)
        pix_h = float(info.get("height") or 0)
        bbox = fitz.Rect(info.get("bbox"))
        if pix_w <= 0 or pix_h <= 0 or bbox.width <= 0 or bbox.height <= 0:
            return None
        dpi_x = pix_w / (bbox.width / 72)
        dpi_y = pix_h / (bbox.height / 72)
        return min(dpi_x, dpi_y)
    except Exception:
        return None


def _info_is_rgb(info: dict) -> bool:
    try:
        cs_name = str(info.get("cs-name") or info.get("colorspace") or "").lower()
        if "rgb" in cs_name:
            return True
        if "cmyk" in cs_name or "gray" in cs_name or "grey" in cs_name:
            return False
        colorspace = info.get("colorspace")
        return colorspace == 3
    except Exception:
        return False


def check_image_dpi(doc: fitz.Document, file_size_bytes: int | None = None) -> CheckItem:
    low_dpi_pages: list[int] = []
    warn_dpi_pages: list[int] = []
    total_pages = len(doc)
    check_limit, sampled, heavy = _image_check_limit(doc, file_size_bytes)

    for page_num in range(check_limit):
        page = doc[page_num]
        infos = _safe_page_image_info(page)
        # Prefer metadata. It avoids extracting 90MB+ image streams into memory.
        for item in infos:
            eff_dpi = _info_effective_dpi(item)
            if eff_dpi is None:
                continue
            if eff_dpi < MIN_DPI_WARN:
                if page_num + 1 not in low_dpi_pages:
                    low_dpi_pages.append(page_num + 1)
            elif eff_dpi < MIN_DPI_PASS:
                if page_num + 1 not in warn_dpi_pages:
                    warn_dpi_pages.append(page_num + 1)

    sample_note = _sample_note(total_pages, check_limit, sampled, heavy)
    if low_dpi_pages:
        return CheckItem(
            id="dpi",
            label="이미지 해상도",
            severity=CheckSeverity.fail,
            detail=f"150 DPI 미만 이미지가 {len(low_dpi_pages)}페이지에서 발견되었습니다. 인쇄 품질이 저하될 수 있습니다.{sample_note}",
            page_refs=low_dpi_pages,
        )
    if warn_dpi_pages:
        return CheckItem(
            id="dpi",
            label="이미지 해상도",
            severity=CheckSeverity.warning,
            detail=f"300 DPI 미만 이미지가 {len(warn_dpi_pages)}페이지에서 발견되었습니다. 고품질 인쇄를 위해 300 DPI 이상을 권장합니다.{sample_note}",
            page_refs=warn_dpi_pages,
        )
    return CheckItem(
        id="dpi",
        label="이미지 해상도",
        severity=CheckSeverity.pass_,
        detail=f"이미지 해상도 메타정보 기준으로 문제가 발견되지 않았습니다.{sample_note}",
    )


def check_bleed(doc: fitz.Document, file_size_bytes: int | None = None) -> CheckItem:
    """Check if pages have sufficient bleed margin (3mm)."""
    bleed_pt = BLEED_MM / PT_TO_MM
    pages_with_content_at_edge: list[int] = []
    skipped_pages: list[int] = []
    total_pages = len(doc)
    check_limit = min(total_pages, MAX_TEXT_CHECK_PAGES)
    sampled = total_pages > MAX_TEXT_CHECK_PAGES

    for page_num in range(check_limit):
        page = doc[page_num]
        rect = page.rect
        try:
            blocks = page.get_text("blocks")
        except Exception:
            skipped_pages.append(page_num + 1)
            continue
        for block in blocks:
            x0, y0, x1, y1 = block[:4]
            if (x0 < bleed_pt or y0 < bleed_pt or
                    x1 > rect.width - bleed_pt or y1 > rect.height - bleed_pt):
                if page_num + 1 not in pages_with_content_at_edge:
                    pages_with_content_at_edge.append(page_num + 1)
                break

    sample_note = _sample_note(total_pages, check_limit, sampled, _is_heavy_pdf(doc, file_size_bytes))
    if skipped_pages and not pages_with_content_at_edge:
        return CheckItem(
            id="bleed",
            label="재단 여백 (도련)",
            severity=CheckSeverity.warning,
            detail=f"일부 페이지의 텍스트/객체 정보를 읽지 못해 도련 검사를 부분 수행했습니다.{sample_note}",
            page_refs=skipped_pages[:20],
        )
    if pages_with_content_at_edge:
        return CheckItem(
            id="bleed",
            label="재단 여백 (도련)",
            severity=CheckSeverity.warning,
            detail=f"{len(pages_with_content_at_edge)}페이지에서 텍스트/이미지가 재단선 3mm 이내에 있습니다. 재단 시 내용이 잘릴 수 있습니다.{sample_note}",
            page_refs=pages_with_content_at_edge,
        )
    return CheckItem(
        id="bleed",
        label="재단 여백 (도련)",
        severity=CheckSeverity.pass_,
        detail=f"재단 여백이 적절합니다.{sample_note}",
    )


def check_color_mode(doc: fitz.Document, file_size_bytes: int | None = None) -> CheckItem:
    rgb_pages: list[int] = []
    unknown_pages: list[int] = []
    total_pages = len(doc)
    check_limit, sampled, heavy = _image_check_limit(doc, file_size_bytes)

    for page_num in range(check_limit):
        page = doc[page_num]
        infos = _safe_page_image_info(page)
        if not infos:
            continue
        known = False
        for item in infos:
            cs_name = str(item.get("cs-name") or item.get("colorspace") or "").lower()
            if cs_name:
                known = True
            if _info_is_rgb(item):
                if page_num + 1 not in rgb_pages:
                    rgb_pages.append(page_num + 1)
                break
        if not known and page_num + 1 not in rgb_pages:
            unknown_pages.append(page_num + 1)

    sample_note = _sample_note(total_pages, check_limit, sampled, heavy)
    if rgb_pages:
        return CheckItem(
            id="color_mode",
            label="색상 모드",
            severity=CheckSeverity.warning,
            detail=f"{len(rgb_pages)}페이지에 RGB 이미지가 포함되어 있습니다. 오프셋 인쇄는 CMYK를 권장합니다.{sample_note}",
            page_refs=rgb_pages,
        )
    if unknown_pages:
        return CheckItem(
            id="color_mode",
            label="색상 모드",
            severity=CheckSeverity.warning,
            detail=f"일부 이미지 색상 모드를 메타정보만으로 확인하지 못했습니다. 파일은 검수 완료했지만 출력 전 샘플 확인을 권장합니다.{sample_note}",
            page_refs=unknown_pages[:20],
        )
    return CheckItem(
        id="color_mode",
        label="색상 모드",
        severity=CheckSeverity.pass_,
        detail=f"이미지 색상 모드 메타정보 기준으로 RGB 문제가 발견되지 않았습니다.{sample_note}",
    )


def check_font_embedding(doc: fitz.Document, file_size_bytes: int | None = None) -> CheckItem:
    not_embedded: list[tuple[str, int]] = []
    skipped_pages: list[int] = []
    total_pages = len(doc)
    check_limit = min(total_pages, MAX_TEXT_CHECK_PAGES)
    sampled = total_pages > MAX_TEXT_CHECK_PAGES

    for page_num in range(check_limit):
        page = doc[page_num]
        try:
            fonts = page.get_fonts(full=True)
        except Exception:
            skipped_pages.append(page_num + 1)
            continue
        for font in fonts:
            try:
                font_name = font[3] or font[4] or "Unknown"
            except Exception:
                font_name = "Unknown"
            try:
                ext = (font[1] or "").strip().lower() if len(font) > 1 else ""
            except Exception:
                ext = ""
            embedded = bool(ext) and ext not in ("n/a", "none")
            if not embedded:
                not_embedded.append((font_name, page_num + 1))

    sample_note = _sample_note(total_pages, check_limit, sampled, _is_heavy_pdf(doc, file_size_bytes))
    if not_embedded:
        font_names = list(set(f[0] for f in not_embedded))
        pages = list(set(f[1] for f in not_embedded))
        return CheckItem(
            id="font_embed",
            label="폰트 임베딩",
            severity=CheckSeverity.fail,
            detail=f"미임베딩 폰트: {', '.join(font_names[:3])}{'...' if len(font_names) > 3 else ''}. 다른 환경에서 폰트가 대체될 수 있습니다.{sample_note}",
            page_refs=sorted(pages),
        )
    if skipped_pages:
        return CheckItem(
            id="font_embed",
            label="폰트 임베딩",
            severity=CheckSeverity.warning,
            detail=f"일부 페이지의 폰트 정보를 읽지 못해 부분 검수했습니다.{sample_note}",
            page_refs=skipped_pages[:20],
        )
    return CheckItem(
        id="font_embed",
        label="폰트 임베딩",
        severity=CheckSeverity.pass_,
        detail=f"모든 폰트가 PDF에 임베딩되어 있습니다.{sample_note}",
    )


def check_page_size_consistency(doc: fitz.Document, file_size_bytes: int | None = None) -> CheckItem:
    if len(doc) == 0:
        return CheckItem(
            id="page_size",
            label="페이지 규격",
            severity=CheckSeverity.warning,
            detail="페이지가 없습니다.",
        )

    first_page = doc[0]
    first_w = round(first_page.rect.width, 1)
    first_h = round(first_page.rect.height, 1)
    size_label = _size_label(first_w, first_h)
    inconsistent: list[int] = []

    for page_num in range(1, len(doc)):
        try:
            page = doc[page_num]
            w = round(page.rect.width, 1)
            h = round(page.rect.height, 1)
        except Exception:
            inconsistent.append(page_num + 1)
            continue
        if abs(w - first_w) > SIZE_TOLERANCE_PT or abs(h - first_h) > SIZE_TOLERANCE_PT:
            inconsistent.append(page_num + 1)

    if inconsistent:
        return CheckItem(
            id="page_size",
            label="페이지 규격",
            severity=CheckSeverity.warning,
            detail=f"첫 페이지({size_label})와 다른 규격의 페이지가 {len(inconsistent)}개 있습니다.",
            page_refs=inconsistent,
        )
    return CheckItem(
        id="page_size",
        label="페이지 규격",
        severity=CheckSeverity.pass_,
        detail=f"모든 페이지가 {size_label} 규격으로 통일되어 있습니다.",
    )


def check_transparency(doc: fitz.Document, file_size_bytes: int | None = None) -> CheckItem:
    pages_with_transparency: list[int] = []
    total_pages = len(doc)
    check_limit, sampled, heavy = _image_check_limit(doc, file_size_bytes)
    for page_num in range(check_limit):
        page = doc[page_num]
        try:
            names_fn = getattr(page, "xobject_names", None)
            if not callable(names_fn):
                continue
            names = names_fn() or []
        except Exception:
            continue
        if any("Transparency" in (n or "") for n in names):
            if page_num + 1 not in pages_with_transparency:
                pages_with_transparency.append(page_num + 1)

    sample_note = _sample_note(total_pages, check_limit, sampled, heavy)
    if pages_with_transparency:
        return CheckItem(
            id="transparency",
            label="투명도",
            severity=CheckSeverity.warning,
            detail=f"{len(pages_with_transparency)}페이지에 투명도 효과가 있습니다. 일부 인쇄 환경에서 렌더링 문제가 발생할 수 있습니다.{sample_note}",
            page_refs=pages_with_transparency,
        )
    return CheckItem(
        id="transparency",
        label="투명도",
        severity=CheckSeverity.pass_,
        detail=f"투명도 문제가 발견되지 않았습니다.{sample_note}",
    )


def check_heavy_pdf_notice(doc: fitz.Document, file_size_bytes: int | None = None) -> CheckItem:
    if not _is_heavy_pdf(doc, file_size_bytes):
        return CheckItem(
            id="file_weight",
            label="파일 용량/복잡도",
            severity=CheckSeverity.pass_,
            detail="파일 용량 기준으로 일반 검수 범위입니다.",
        )
    mb = round((file_size_bytes or 0) / 1024 / 1024, 1)
    avg = round((file_size_bytes or 0) / max(1, len(doc)) / 1024 / 1024, 1)
    return CheckItem(
        id="file_weight",
        label="파일 용량/복잡도",
        severity=CheckSeverity.warning,
        detail=f"{len(doc)}페이지 / {mb}MB 파일입니다. 페이지당 평균 {avg}MB로 무거운 PDF라 이미지·색상·투명도 검사는 빠른검수 방식으로 샘플링했습니다. 필요 시 PDF 복구/정상화 후 다시 검수하세요.",
    )


def _safe_run(check_fn, fn_id: str, label: str, doc: fitz.Document, file_size_bytes: int | None = None) -> CheckItem:
    try:
        return check_fn(doc, file_size_bytes)
    except TypeError:
        try:
            return check_fn(doc)
        except Exception as e:
            return CheckItem(
                id=fn_id, label=label,
                severity=CheckSeverity.warning,
                detail=f"검사 실행 중 오류로 건너뜀: {type(e).__name__}: {str(e)[:120]}",
            )
    except Exception as e:
        return CheckItem(
            id=fn_id, label=label,
            severity=CheckSeverity.warning,
            detail=f"검사 실행 중 오류로 건너뜀: {type(e).__name__}: {str(e)[:120]}",
        )


def run_all_checks(doc: fitz.Document, file_size_bytes: int | None = None) -> list[CheckItem]:
    checks = [
        _safe_run(check_heavy_pdf_notice,     "file_weight",  "파일 용량/복잡도", doc, file_size_bytes),
        _safe_run(check_image_dpi,            "dpi",          "이미지 해상도",   doc, file_size_bytes),
        _safe_run(check_bleed,                "bleed",        "재단 여백 (도련)", doc, file_size_bytes),
        _safe_run(check_color_mode,           "color_mode",   "색상 모드",       doc, file_size_bytes),
        _safe_run(check_font_embedding,       "font_embed",   "폰트 임베딩",     doc, file_size_bytes),
        _safe_run(check_page_size_consistency,"page_size",    "페이지 규격",     doc, file_size_bytes),
        _safe_run(check_transparency,         "transparency", "투명도",         doc, file_size_bytes),
    ]
    # Keep normal reports compact while showing the notice only when useful.
    return [c for c in checks if not (c.id == "file_weight" and c.severity == CheckSeverity.pass_)]


def compute_score(checks: list[CheckItem]) -> int:
    score = 100
    for c in checks:
        if c.severity == CheckSeverity.fail:
            score -= 25
        elif c.severity == CheckSeverity.warning:
            score -= 10
    return max(0, score)
