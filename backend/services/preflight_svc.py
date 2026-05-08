"""
Pre-flight PDF checks: DPI, bleed, color mode, font embedding, page size consistency.
"""
import fitz
from models.schemas import CheckItem, CheckSeverity

PT_TO_MM = 25.4 / 72
BLEED_MM = 3.0
MIN_DPI_PASS = 300
MIN_DPI_WARN = 150

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


def check_image_dpi(doc: fitz.Document) -> CheckItem:
    low_dpi_pages: list[int] = []
    warn_dpi_pages: list[int] = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        try:
            images = page.get_images(full=True)
        except Exception:
            images = []
        for img in images:
            xref = img[0]
            try:
                base_image = doc.extract_image(xref)
            except Exception:
                continue
            pix_w = base_image.get("width", 0)
            pix_h = base_image.get("height", 0)
            if not pix_w or not pix_h:
                continue

            # Get image placement rect to compute effective DPI
            try:
                infos = page.get_image_info(hashes=False)
            except TypeError:
                try:
                    infos = page.get_image_info()
                except Exception:
                    infos = []
            except Exception:
                infos = []
            for item in infos:
                if item.get("xref") == xref:
                    try:
                        bbox = fitz.Rect(item["bbox"])
                    except Exception:
                        break
                    render_w_pt = bbox.width
                    render_h_pt = bbox.height
                    if render_w_pt > 0 and render_h_pt > 0:
                        dpi_x = pix_w / (render_w_pt / 72)
                        dpi_y = pix_h / (render_h_pt / 72)
                        eff_dpi = min(dpi_x, dpi_y)
                        if eff_dpi < MIN_DPI_WARN:
                            if page_num + 1 not in low_dpi_pages:
                                low_dpi_pages.append(page_num + 1)
                        elif eff_dpi < MIN_DPI_PASS:
                            if page_num + 1 not in warn_dpi_pages:
                                warn_dpi_pages.append(page_num + 1)
                    break

    if low_dpi_pages:
        return CheckItem(
            id="dpi",
            label="이미지 해상도",
            severity=CheckSeverity.fail,
            detail=f"150 DPI 미만 이미지가 {len(low_dpi_pages)}페이지에서 발견되었습니다. 인쇄 품질이 저하될 수 있습니다.",
            page_refs=low_dpi_pages,
        )
    if warn_dpi_pages:
        return CheckItem(
            id="dpi",
            label="이미지 해상도",
            severity=CheckSeverity.warning,
            detail=f"300 DPI 미만 이미지가 {len(warn_dpi_pages)}페이지에서 발견되었습니다. 고품질 인쇄를 위해 300 DPI 이상을 권장합니다.",
            page_refs=warn_dpi_pages,
        )
    return CheckItem(
        id="dpi",
        label="이미지 해상도",
        severity=CheckSeverity.pass_,
        detail="모든 이미지 해상도가 300 DPI 이상입니다.",
    )


def check_bleed(doc: fitz.Document) -> CheckItem:
    """Check if pages have sufficient bleed margin (3mm)."""
    bleed_pt = BLEED_MM / PT_TO_MM
    pages_with_content_at_edge: list[int] = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        rect = page.rect
        # Check if any drawing or text touches the edge within bleed margin
        blocks = page.get_text("blocks")
        for block in blocks:
            x0, y0, x1, y1 = block[:4]
            if (x0 < bleed_pt or y0 < bleed_pt or
                    x1 > rect.width - bleed_pt or y1 > rect.height - bleed_pt):
                if page_num + 1 not in pages_with_content_at_edge:
                    pages_with_content_at_edge.append(page_num + 1)
                break

    if pages_with_content_at_edge:
        return CheckItem(
            id="bleed",
            label="재단 여백 (도련)",
            severity=CheckSeverity.warning,
            detail=f"{len(pages_with_content_at_edge)}페이지에서 텍스트/이미지가 재단선 3mm 이내에 있습니다. 재단 시 내용이 잘릴 수 있습니다.",
            page_refs=pages_with_content_at_edge,
        )
    return CheckItem(
        id="bleed",
        label="재단 여백 (도련)",
        severity=CheckSeverity.pass_,
        detail="모든 페이지의 재단 여백이 적절합니다.",
    )


def check_color_mode(doc: fitz.Document) -> CheckItem:
    rgb_pages: list[int] = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        try:
            images = page.get_images(full=True)
        except Exception:
            images = []
        for img in images:
            xref = img[0]
            try:
                base_image = doc.extract_image(xref)
            except Exception:
                continue
            colorspace = base_image.get("colorspace", 3)
            # 3 = RGB, 4 = CMYK
            if colorspace == 3:
                if page_num + 1 not in rgb_pages:
                    rgb_pages.append(page_num + 1)
                break

    if rgb_pages:
        return CheckItem(
            id="color_mode",
            label="색상 모드",
            severity=CheckSeverity.warning,
            detail=f"{len(rgb_pages)}페이지에 RGB 이미지가 포함되어 있습니다. 오프셋 인쇄는 CMYK를 권장합니다.",
            page_refs=rgb_pages,
        )
    return CheckItem(
        id="color_mode",
        label="색상 모드",
        severity=CheckSeverity.pass_,
        detail="모든 이미지가 CMYK 색상 모드입니다.",
    )


def check_font_embedding(doc: fitz.Document) -> CheckItem:
    not_embedded: list[tuple[str, int]] = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        try:
            fonts = page.get_fonts(full=True)
        except Exception:
            fonts = []
        for font in fonts:
            try:
                font_name = font[3] or font[4] or "Unknown"
            except Exception:
                font_name = "Unknown"
            # In PyMuPDF, get_fonts returns tuples: (xref, ext, type, basefont, name, encoding, ...).
            # Embedded status is reflected by `ext` being non-empty (e.g. 'ttf', 'otf', 'cff').
            try:
                ext = (font[1] or "").strip().lower() if len(font) > 1 else ""
            except Exception:
                ext = ""
            embedded = bool(ext) and ext not in ("n/a", "none")
            if not embedded:
                not_embedded.append((font_name, page_num + 1))

    if not_embedded:
        font_names = list(set(f[0] for f in not_embedded))
        pages = list(set(f[1] for f in not_embedded))
        return CheckItem(
            id="font_embed",
            label="폰트 임베딩",
            severity=CheckSeverity.fail,
            detail=f"미임베딩 폰트: {', '.join(font_names[:3])}{'...' if len(font_names) > 3 else ''}. 다른 환경에서 폰트가 대체될 수 있습니다.",
            page_refs=sorted(pages),
        )
    return CheckItem(
        id="font_embed",
        label="폰트 임베딩",
        severity=CheckSeverity.pass_,
        detail="모든 폰트가 PDF에 임베딩되어 있습니다.",
    )


def check_page_size_consistency(doc: fitz.Document) -> CheckItem:
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
        page = doc[page_num]
        w = round(page.rect.width, 1)
        h = round(page.rect.height, 1)
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


def check_transparency(doc: fitz.Document) -> CheckItem:
    pages_with_transparency: list[int] = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        # `xobject_names()` is unavailable in newer PyMuPDF builds; gracefully skip.
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

    if pages_with_transparency:
        return CheckItem(
            id="transparency",
            label="투명도",
            severity=CheckSeverity.warning,
            detail=f"{len(pages_with_transparency)}페이지에 투명도 효과가 있습니다. 일부 인쇄 환경에서 렌더링 문제가 발생할 수 있습니다.",
            page_refs=pages_with_transparency,
        )
    return CheckItem(
        id="transparency",
        label="투명도",
        severity=CheckSeverity.pass_,
        detail="투명도 문제가 없습니다.",
    )


def _safe_run(check_fn, fn_id: str, label: str, doc: fitz.Document) -> CheckItem:
    try:
        return check_fn(doc)
    except Exception as e:
        return CheckItem(
            id=fn_id, label=label,
            severity=CheckSeverity.warning,
            detail=f"검사 실행 중 오류로 건너뜀: {type(e).__name__}: {str(e)[:120]}",
        )


def run_all_checks(doc: fitz.Document) -> list[CheckItem]:
    return [
        _safe_run(check_image_dpi,            "dpi",          "이미지 해상도",   doc),
        _safe_run(check_bleed,                "bleed",        "재단 여백 (도련)", doc),
        _safe_run(check_color_mode,           "color_mode",   "색상 모드",       doc),
        _safe_run(check_font_embedding,       "font_embed",   "폰트 임베딩",     doc),
        _safe_run(check_page_size_consistency,"page_size",    "페이지 규격",     doc),
        _safe_run(check_transparency,         "transparency", "투명도",         doc),
    ]


def compute_score(checks: list[CheckItem]) -> int:
    score = 100
    for c in checks:
        if c.severity == CheckSeverity.fail:
            score -= 25
        elif c.severity == CheckSeverity.warning:
            score -= 10
    return max(0, score)
