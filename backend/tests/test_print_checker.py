from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_print_checker_html_loads_stabilized_tool():
    html = read("print-checker/index.html")
    assert "인쇄물 사전 검토" in html
    assert "print-checker.js?v=20260904-2" in html
    assert "print-checker.css?v=20260904-2" in html
    assert "reliability.js?v=20260904-1" in html
    assert "firebase-firestore-compat.js" in html
    assert "js/print-checker/access.js?v=20260907-2" in html
    assert "js/pdf-daily-free.js?v=20260907-2" in html
    assert "js/print-checker/defaults-live.js?v=20260906-1" in html
    for element_id in (
        "productGrid", "uploadZone", "specForm", "reportSection", "previewCanvas",
        "uploadFileInfo", "canvasFileInfo", "sideSelectRow",
    ):
        assert f'id="{element_id}"' in html


def test_print_checker_html_has_no_duplicate_ids_or_tiff_promise():
    html = read("print-checker/index.html")
    ids = re.findall(r'\bid="([^"]+)"', html)
    assert len(ids) == len(set(ids))
    assert "image/tiff" not in html
    assert "TIFF" not in html


def test_print_checker_covers_all_product_types_and_query_aliases():
    js = read("js/print-checker/print-checker.js")
    for product in ("cover", "leaflet", "flyer", "invitation", "booklet"):
        assert product in js
    assert "URLSearchParams(location.search)" in js
    assert "PRODUCT_ALIASES" in js
    assert "poster: 'flyer'" in js
    assert "notice: 'invitation'" in js


def test_print_checker_uses_real_pdf_rendering_and_physical_mm_checks():
    js = read("js/print-checker/print-checker.js")
    assert "pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.js" in js
    assert "getDocument({ data: bytes })" in js
    assert "page.getViewport({ scale: 1 })" in js
    assert "25.4 / 72" in js
    assert "renderPdfPage" in js
    assert "PDF 실제 규격" in js
    assert "PDF 페이지 수" in js
    assert "PDF_MM_TOLERANCE" in js


def test_print_checker_switches_two_page_pdf_front_and_back():
    js = read("js/print-checker/print-checker.js")
    assert "canUseBackSide" in js
    assert "sidePageNumber" in js
    assert "setFileSide" in js
    assert "앞면 · PDF 1p" in js
    assert "뒷면 · PDF 2p" in js
    assert "documentProxy.numPages > 1" in js


def test_print_checker_validates_bleed_safe_zone_spine_fold():
    js = read("js/print-checker/print-checker.js")
    for function in ("checkBleed", "checkSafeZone", "checkSpine", "checkFold"):
        assert function in js
    for value in ("bleed", "safeZone", "spine", "gutterMargin"):
        assert value in js


def test_print_checker_renders_canvas_overlay_with_legend_and_imposition():
    js = read("js/print-checker/print-checker.js")
    for function in ("drawCanvas", "drawRect", "drawLegend", "drawGuideLines", "computeImposition"):
        assert function in js
    for label in ("재단선", "안전 영역", "책등", "접지선", "중철 임포지션"):
        assert label in js


def test_print_checker_supports_fold_types():
    js = read("js/print-checker/print-checker.js")
    for fold in ("2fold", "3roll", "3zfold", "4fold"):
        assert fold in js
    assert "FOLD_PAGES" in js
    assert "outside" in js and "inside" in js


def test_print_checker_report_has_pass_warn_fail_info():
    js = read("js/print-checker/print-checker.js")
    css = read("css/print-checker.css")
    assert "renderReport" in js
    for cls in ("status-pass", "status-warn", "status-fail", "status-info"):
        assert cls in css
    for label in ("이상 없음", "주의 필요", "조치 필요"):
        assert label in js


def test_print_checker_reliability_guard_recovers_pdf_loader_and_invalidates_stale_results():
    js = read("js/print-checker/reliability.js")
    assert "printCheckerPdfJs" in js
    assert "MutationObserver" in js
    assert "PDF_LOAD_TIMEOUT_MS" in js
    assert "script.dispatchEvent(new Event('error'))" in js
    assert "queueMicrotask" in js
    assert "invalidateReport" in js
    assert "reportSection" in js
    assert "specForm" in js
    assert "fileHasBleed" in js
    assert "fileInput.value = ''" in js


def test_print_checker_uses_public_configurable_daily_free_access_policy():
    access = read("js/print-checker/access.js")
    assert "ProgramAccess.guardTool" not in access
    assert "approval-waiting.html" not in access
    assert "mode:'daily-free'" in access
    assert "window.ProgramPdfDailyFree?.guestLimit??3" in access
    assert "window.ProgramPdfDailyFree?.memberLimit??10" in access
    assert "quota.status()" in access
    assert "status.limit" in access
    assert "비회원 · 하루 ${status.limit}회 무료" in access


def test_apps_index_redirects_design_shortcuts_with_product_context():
    html = read("apps/index.html")
    assert "/print-checker?product=" in html
    for key in ("cover", "flyer", "invitation", "leaflet"):
        assert key in html
    assert "design-editor/general" not in html


def test_firebase_hosting_has_print_checker_rewrite_and_pdf_worker_csp():
    cfg = read("firebase.json")
    assert '"source": "/print-checker"' in cfg
    assert '"destination": "/print-checker/index.html"' in cfg
    assert "worker-src 'self' blob: https://cdn.jsdelivr.net" in cfg
