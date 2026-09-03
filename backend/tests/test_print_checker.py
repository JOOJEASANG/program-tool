from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_print_checker_html_loads_unified_tool():
    html = read("print-checker/index.html")
    assert "인쇄물 사전 검토" in html
    assert "print-checker.js?v=20260903-5" in html
    assert "productGrid" in html
    assert "uploadZone" in html
    assert "specForm" in html
    assert "reportSection" in html
    assert "previewCanvas" in html


def test_print_checker_html_covers_all_product_types():
    js = read("js/print-checker/print-checker.js")
    for product in ("cover", "leaflet", "flyer", "invitation"):
        assert product in js


def test_print_checker_validates_bleed_safe_zone_spine_fold():
    js = read("js/print-checker/print-checker.js")
    assert "checkBleed" in js
    assert "checkSafeZone" in js
    assert "checkSpine" in js
    assert "checkFold" in js
    assert "bleed" in js
    assert "safeZone" in js
    assert "spine" in js


def test_print_checker_renders_canvas_overlay_with_legend():
    js = read("js/print-checker/print-checker.js")
    assert "drawCanvas" in js
    assert "drawRect" in js
    assert "drawLegend" in js
    assert "재단선" in js
    assert "안전 영역" in js
    assert "책등" in js
    assert "접지선" in js


def test_print_checker_supports_fold_types():
    js = read("js/print-checker/print-checker.js")
    for fold in ("2fold", "3roll", "3zfold", "4fold"):
        assert fold in js
    assert "gutterMargin" in js
    assert "panels" in js


def test_print_checker_report_has_pass_warn_fail_info():
    js = read("js/print-checker/print-checker.js")
    html = read("print-checker/index.html")
    assert "renderReport" in js
    # CSS status classes live in the HTML stylesheet
    for cls in ("status-pass", "status-warn", "status-fail", "status-info"):
        assert cls in html
    # Status labels are in the JS runtime
    assert "이상 없음" in js
    assert "주의 필요" in js
    assert "조치 필요" in js
    # Dynamic class assignment pattern
    assert "status-${it.status}" in js or "status-${overall}" in js


def test_apps_index_redirects_to_print_checker():
    html = read("apps/index.html")
    assert "/print-checker?product=" in html
    for key in ("cover", "flyer", "invitation", "leaflet"):
        assert key in html
    assert "design-editor/general" not in html


def test_firebase_json_has_print_checker_rewrite():
    cfg = read("firebase.json")
    assert "/print-checker" in cfg
    assert "print-checker/index.html" in cfg
