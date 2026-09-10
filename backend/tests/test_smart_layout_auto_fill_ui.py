from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_smart_layout_defaults_to_no_rotation_and_has_no_quantity_input():
    html = (ROOT / "smart-print-layout" / "index.html").read_text(encoding="utf-8")
    app = (ROOT / "js" / "smart-print-layout" / "app.js").read_text(encoding="utf-8")

    assert '<input id="allowRotate" type="checkbox">' in html
    assert '<input id="allowRotate" type="checkbox" checked>' not in html
    assert "qty-row" not in app
    assert "item.quantity" not in app
    assert "수량 자동" in app


def test_smart_layout_auto_fills_each_sheet_and_centers_preview_and_output():
    html = (ROOT / "smart-print-layout" / "index.html").read_text(encoding="utf-8")
    app = (ROOT / "js" / "smart-print-layout" / "app.js").read_text(encoding="utf-8")
    router = (ROOT / "backend" / "routers" / "pdf_smart_layout.py").read_text(encoding="utf-8")
    service = (ROOT / "backend" / "services" / "smart_print_layout_auto.py").read_text(encoding="utf-8")

    assert "app.js?v=20260910-2" in html
    assert "function centerSheet" in app
    assert "packOneFile" in app
    assert "auto_fill: true" in app
    assert "auto-fill-centered-v2" in app
    assert "build_auto_fill_layout_plan" in router
    assert "if settings.auto_fill" in router
    assert "def _center_sheet" in service
    assert "one physical sheet" in service
