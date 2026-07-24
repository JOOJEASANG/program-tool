from pathlib import Path
from types import SimpleNamespace

import pytest

from models.schemas import PdfProcessRequest
from services.pdf_individual_margin_patch import _page_number_value, _resolve_layout_margins
from services.pdf_ops import MM_TO_PT


ROOT = Path(__file__).resolve().parents[2]


def _request(**overrides):
    data = {
        "pages": [{"file_index": 0, "page_index": 0}],
        "margin_h_mm": 10,
        "margin_v_mm": 10,
        "margin_left_mm": 25,
        "margin_right_mm": 10,
        "margin_top_mm": 12,
        "margin_bottom_mm": 8,
        "facing_pages": True,
    }
    data.update(overrides)
    return PdfProcessRequest.model_validate(data)


def test_schema_accepts_four_independent_margins():
    request = _request()
    assert request.margin_left_mm == 25
    assert request.margin_right_mm == 10
    assert request.margin_top_mm == 12
    assert request.margin_bottom_mm == 8


def test_facing_pages_swap_only_left_and_right_on_even_pages():
    request = _request()
    odd = _resolve_layout_margins(request, 0)
    even = _resolve_layout_margins(request, 1)

    assert odd == pytest.approx((25 * MM_TO_PT, 10 * MM_TO_PT, 12 * MM_TO_PT, 8 * MM_TO_PT))
    assert even == pytest.approx((10 * MM_TO_PT, 25 * MM_TO_PT, 12 * MM_TO_PT, 8 * MM_TO_PT))


def test_legacy_paired_margins_remain_compatible():
    request = _request(
        margin_left_mm=None,
        margin_right_mm=None,
        margin_top_mm=None,
        margin_bottom_mm=None,
        margin_h_mm=14,
        margin_v_mm=9,
        facing_pages=False,
    )
    assert _resolve_layout_margins(request, 0) == pytest.approx(
        (14 * MM_TO_PT, 14 * MM_TO_PT, 9 * MM_TO_PT, 9 * MM_TO_PT)
    )


def test_cover_exclusion_numbering_matches_browser_preview():
    settings = SimpleNamespace(exclude_first=True, start=1)
    assert _page_number_value(settings, 1, 6) == (1, 5)
    assert _page_number_value(settings, 5, 6) == (5, 5)


def test_frontend_margin_module_and_export_payload_are_connected():
    loader = (ROOT / "js" / "pdf-editor" / "loader.js").read_text(encoding="utf-8")
    module = (ROOT / "js" / "pdf-editor" / "individual-margins-facing-pages.js").read_text(encoding="utf-8")
    export = (ROOT / "js" / "pdf-editor" / "layout-export.js").read_text(encoding="utf-8")

    assert "individual-margins-facing-pages.js" in loader
    assert loader.rfind("individual-margins-facing-pages.js") > loader.rfind("dock-width-align.js")
    for field in ("marginLeft", "marginRight", "marginTop", "marginBottom"):
        assert field in module
    for field in ("margin_left_mm", "margin_right_mm", "margin_top_mm", "margin_bottom_mm"):
        assert field in export
    assert "짝수 페이지는 좌·우 여백과 페이지 번호 위치를 반대로 적용" in module


def test_preview_header_hints_do_not_use_infinite_polling_or_full_width_cards():
    live = (ROOT / "js" / "pdf-editor" / "live-preview.js").read_text(encoding="utf-8")
    count = (ROOT / "js" / "pdf-editor" / "page-count-hint.js").read_text(encoding="utf-8")
    module = (ROOT / "js" / "pdf-editor" / "individual-margins-facing-pages.js").read_text(encoding="utf-8")

    assert "setInterval(" not in live
    assert "setInterval(" not in count
    assert "removeAttribute('title')" in count
    assert "pdf-preview-toolbar" in module
    assert "preview-copy-group" in module
    assert "grid-template-columns:minmax(0,1fr) auto" in module
