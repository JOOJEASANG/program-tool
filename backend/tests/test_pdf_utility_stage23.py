from pathlib import Path

import fitz

from routers.pdf_utility import (
    BACKGROUND_DPI,
    MAX_FILES,
    MAX_TOTAL_BYTES,
    MAX_TOTAL_PAGES,
    _clean_background_pdf,
    _merge_pdf_bytes,
)


ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "js" / "pdf-utility.js"
FINALIZER = ROOT / "js" / "pdf-utility-finalize.js"
SW_REGISTER = ROOT / "js" / "sw-register.js"
CATALOG = ROOT / "js" / "program-catalog-core.js"
MAIN = ROOT / "backend" / "main.py"
PERMISSIONS = ROOT / "backend" / "utils" / "permissions.py"
REQUIREMENTS = ROOT / "backend" / "requirements.txt"


def _pdf_bytes(page_count=1, fill=None):
    doc = fitz.open()
    try:
        for index in range(page_count):
            page = doc.new_page(width=180, height=240)
            if fill is not None:
                page.draw_rect(page.rect, color=None, fill=fill, overlay=False)
            page.insert_text((24, 50), f"PAGE {index + 1}", fontsize=14, color=(0, 0, 0))
        return doc.tobytes(garbage=4, deflate=True)
    finally:
        doc.close()


def test_pdf_utility_merge_preserves_file_order_and_page_count():
    first = _pdf_bytes(2)
    second = _pdf_bytes(3)
    merged, pages = _merge_pdf_bytes([("first.pdf", first), ("second.pdf", second)])
    assert pages == 5
    doc = fitz.open(stream=merged, filetype="pdf")
    try:
        assert doc.page_count == 5
        assert "PAGE 1" in doc[0].get_text()
        assert "PAGE 2" in doc[1].get_text()
        assert "PAGE 1" in doc[2].get_text()
    finally:
        doc.close()


def test_background_cleanup_keeps_page_count_and_whitens_light_background():
    source = _pdf_bytes(1, fill=(0.94, 0.94, 0.94))
    cleaned, pages = _clean_background_pdf(source, "medium")
    assert pages == 1
    doc = fitz.open(stream=cleaned, filetype="pdf")
    try:
        assert doc.page_count == 1
        pix = doc[0].get_pixmap(dpi=72, colorspace=fitz.csRGB, alpha=False)
        corner = pix.pixel(5, 5)
        assert min(corner[:3]) >= 245
    finally:
        doc.close()


def test_pdf_utility_limits_routes_and_access_are_bounded():
    assert MAX_FILES == 10
    assert MAX_TOTAL_BYTES == 200 * 1024 * 1024
    assert MAX_TOTAL_PAGES == 1000
    assert BACKGROUND_DPI == 180

    main = MAIN.read_text(encoding="utf-8")
    permissions = PERMISSIONS.read_text(encoding="utf-8")
    assert "from routers.pdf_utility import pdf_utility_bp" in main
    assert 'url_prefix="/api/pdf-utility"' in main
    assert '("/api/pdf-utility", "preflight")' in permissions


def test_pdf_utility_frontend_has_batch_merge_background_and_single_file_tools():
    source = FRONTEND.read_text(encoding="utf-8")
    for marker in (
        "MAX_FILES = 10",
        "MAX_TOTAL_BYTES = 200 * 1024 * 1024",
        "runBatchCheck",
        "runMerge",
        "background-cleanup-storage",
        "PDF 합치기",
        "배경색 제거",
        "PDF 용량 줄이기",
        "PDF 복구·정상화",
        "드래그하거나 ↑↓ 버튼",
        "텍스트 선택·검색이나 링크 기능이 사라질 수 있고",
        "pdf-utility-batch-tools-v1",
    ):
        assert marker in source


def test_pdf_utility_runtime_loads_after_existing_preflight_guards():
    source = SW_REGISTER.read_text(encoding="utf-8")
    finalizer = FINALIZER.read_text(encoding="utf-8")
    assert "pdfCheckerFinalGuardScript" in source
    assert "pdfPreflightPanelBalanceScript" in source
    assert "Promise.all([finalGuard,panelBalance])" in source
    assert "/js/pdf-utility.js?v=20260818-1" in source
    assert "pdfUtilityFinalizeScriptV1" in source
    assert "/js/pdf-utility-finalize.js?v=20260818-2" in source
    assert "pdfToolsResetBelowStyle" in finalizer
    assert "wrapBusyState" in finalizer
    assert "MutationObserver" in finalizer
    assert "window.runCheck = utility.runBatchCheck" in finalizer
    assert "최대 10개 일괄 검수" in finalizer


def test_pdf_utility_name_migrates_legacy_catalog_entry():
    source = CATALOG.read_text(encoding="utf-8")
    assert "LEGACY_PDF_UTILITY_NAMES" in source
    assert "PDF 인쇄 검수" in source
    assert "PDF 검사" in source
    assert "name: 'PDF유틸리티'" in source
    assert "id === 'pdf-preflight'" in source
    assert "PDF 합치기" in source
    assert "배경 제거" in source


def test_background_cleanup_dependency_is_pinned():
    requirements = REQUIREMENTS.read_text(encoding="utf-8")
    constraints = (ROOT / "backend" / "constraints.txt").read_text(encoding="utf-8")
    assert "Pillow==12.3.0" in requirements
    assert "Pillow==12.3.0" in constraints
