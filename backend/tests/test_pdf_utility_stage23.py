from pathlib import Path

import fitz

from routers.pdf_utility import (
    MAX_FILES,
    MAX_TOTAL_PAGES,
    _clean_background_pdf,
    _merge_pdf_bytes,
)


ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "js" / "pdf-utility.js"
FINALIZER = ROOT / "js" / "pdf-utility-finalize.js"
PREFLIGHT_RUNTIME = ROOT / "js" / "pdf-preflight" / "route-runtime.js"
HOME = ROOT / "index.html"
GLOBAL_UI = ROOT / "js" / "program-studio-ui-v2.js"
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
    assert MAX_TOTAL_PAGES == 1000
    main = MAIN.read_text(encoding="utf-8")
    permissions = PERMISSIONS.read_text(encoding="utf-8")
    assert "from routers.pdf_utility import pdf_utility_bp" in main
    assert 'url_prefix="/api/pdf-utility"' in main
    assert '("/api/pdf-utility", "preflight")' in permissions


def test_pdf_utility_frontend_has_batch_merge_background_and_single_file_tools():
    source = FRONTEND.read_text(encoding="utf-8")
    for marker in (
        "MAX_FILES = 10",
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


def test_pdf_utility_runtime_is_ordered_by_canonical_preflight_manifest():
    runtime = PREFLIGHT_RUNTIME.read_text(encoding="utf-8")
    finalizer = FINALIZER.read_text(encoding="utf-8")
    expected = [
        "pdfCheckerFinalGuardScript",
        "pdfUtilityScriptV1",
        "pdfUtilityFinalizeScriptV1",
        "pdfPreflightPanelBalanceScriptV1",
    ]
    for marker in expected:
        assert marker in runtime
    assert runtime.index("pdfCheckerFinalGuardScript") < runtime.index("pdfUtilityScriptV1")
    assert runtime.index("pdfUtilityScriptV1") < runtime.index("pdfUtilityFinalizeScriptV1")
    assert runtime.index("pdfUtilityFinalizeScriptV1") < runtime.index("pdfPreflightPanelBalanceScriptV1")
    assert "/js/pdf-utility.js?v=20260831-1" in runtime
    assert "/js/pdf-utility-finalize.js?v=20260831-2" in runtime
    assert "pdfToolsResetBelowStyle" in finalizer
    assert "wrapBusyState" in finalizer
    assert "MutationObserver" in finalizer
    assert "window.runCheck=utility.runBatchCheck" in finalizer
    assert "최대 10개 일괄 검수" in finalizer


def test_pdf_utility_name_uses_current_static_home_without_legacy_catalog_runtime():
    home = HOME.read_text(encoding="utf-8")
    ui = GLOBAL_UI.read_text(encoding="utf-8")
    assert "PDF 도구 모음" in home
    assert "PDF 검사 · 유틸리티" in ui
    assert "url:'/pdf-preflight/'" in ui
    assert not (ROOT / "js" / "program-catalog-core.js").exists()


def test_background_cleanup_dependency_is_pinned():
    requirements = REQUIREMENTS.read_text(encoding="utf-8")
    constraints = (ROOT / "backend" / "constraints.txt").read_text(encoding="utf-8")
    assert "Pillow==12.3.0" in requirements
    assert "Pillow==12.3.0" in constraints
