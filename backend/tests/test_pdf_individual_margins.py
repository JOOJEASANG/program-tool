from pathlib import Path
from types import SimpleNamespace

import pytest

from models.schemas import PdfProcessRequest
from services import pdf_page_number_reserve_patch  # noqa: F401
from services.pdf_individual_margin_patch import (
    _base_layout_margins,
    _page_number_value,
    _resolve_layout_margins,
)
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


def test_page_number_auto_reserve_expands_from_actual_number_anchor():
    request = _request(
        facing_pages=False,
        margin_top_mm=6,
        margin_bottom_mm=25,
        page_numbers={
            "enabled": True,
            "position": "bottom-right",
            "font_size": 12,
            "margin_mm": 5,
            "auto_reserve_space": True,
        },
    )
    base = _base_layout_margins(request, 0)
    resolved = _resolve_layout_margins(request, 0)
    assert resolved[0] == pytest.approx(base[0])
    assert resolved[1] == pytest.approx(base[1])
    assert resolved[2] == pytest.approx(6 * MM_TO_PT)
    assert resolved[3] > 25 * MM_TO_PT


def test_page_number_auto_reserve_can_be_disabled():
    request = _request(
        facing_pages=False,
        margin_bottom_mm=7,
        page_numbers={
            "enabled": True,
            "position": "bottom-center",
            "font_size": 16,
            "margin_mm": 25,
            "auto_reserve_space": False,
        },
    )
    assert _resolve_layout_margins(request, 0)[3] == pytest.approx(7 * MM_TO_PT)


def test_cover_exclusion_numbering_matches_browser_preview():
    settings = SimpleNamespace(exclude_first=True, start=1)
    assert _page_number_value(settings, 1, 6) == (1, 5)
    assert _page_number_value(settings, 5, 6) == (5, 5)


def test_frontend_margin_selection_and_export_modules_are_connected():
    loader = (ROOT / "js" / "pdf-editor" / "loader.js").read_text(encoding="utf-8")
    margin_module = (ROOT / "js" / "pdf-editor" / "individual-margins-facing-pages.js").read_text(encoding="utf-8")
    export_module = (ROOT / "js" / "pdf-editor" / "layout-export.js").read_text(encoding="utf-8")
    selection_module = (ROOT / "js" / "pdf-editor" / "page-selection-preview-focus.js").read_text(encoding="utf-8")
    reserve_module = (ROOT / "js" / "pdf-editor" / "page-number-auto-reserve.js").read_text(encoding="utf-8")
    reserve_v2 = (ROOT / "js" / "pdf-editor" / "page-number-auto-reserve-layout-v2.js").read_text(encoding="utf-8")

    assert "individual-margins-facing-pages.js" in loader
    assert loader.rfind("page-number-auto-reserve.js") > loader.rfind("individual-margins-facing-pages.js")
    assert loader.rfind("page-number-auto-reserve-layout-v2.js") > loader.rfind("page-number-auto-reserve.js")
    assert loader.rfind("page-selection-preview-focus.js") > loader.rfind("page-number-auto-reserve-layout-v2.js")
    for field in ("marginLeft", "marginRight", "marginTop", "marginBottom"):
        assert field in margin_module
    for field in ("margin_left_mm", "margin_right_mm", "margin_top_mm", "margin_bottom_mm"):
        assert field in export_module
    assert "auto_reserve_space" in export_module
    assert "Ctrl/Shift=다중선택" in selection_module
    assert "선택 페이지 숨기기" in selection_module
    assert "displayPreviewKeepingFocus" in selection_module
    assert "페이지 번호 공간 자동 확보" in reserve_module
    assert "fontMm * 1.8" in reserve_v2


def test_pdf_dock_uses_flat_sidebar_section_with_cover_color_divider():
    pdf_dock = (ROOT / "js" / "pdf-editor" / "dock-width-align.js").read_text(encoding="utf-8")
    cover_dock = (ROOT / "js" / "cover-floating-action-dock.js").read_text(encoding="utf-8")

    assert "linear-gradient(90deg,#12396d,#2563eb,#1d9bb2)" in pdf_dock
    assert "linear-gradient(90deg,#12396d,#2563eb,#1d9bb2)" in cover_dock
    assert "border-radius:0!important" in pdf_dock
    assert "box-shadow:none!important" in pdf_dock
    assert "backdrop-filter:none!important" in pdf_dock
    assert "bottom:0!important" in pdf_dock
    assert "grid-template-columns:repeat(3,minmax(0,1fr))" in pdf_dock
    assert "#previewBtn" in pdf_dock
    assert "#downloadBtn" in pdf_dock
    assert "#resetBtn" in pdf_dock


def test_interaction_modules_have_no_unbounded_polling():
    live = (ROOT / "js" / "pdf-editor" / "live-preview.js").read_text(encoding="utf-8")
    count = (ROOT / "js" / "pdf-editor" / "page-count-hint.js").read_text(encoding="utf-8")
    multi = (ROOT / "js" / "pdf-editor" / "multifile-interaction-fix.js").read_text(encoding="utf-8")
    selection = (ROOT / "js" / "pdf-editor" / "page-selection-preview-focus.js").read_text(encoding="utf-8")
    reserve = (ROOT / "js" / "pdf-editor" / "page-number-auto-reserve.js").read_text(encoding="utf-8")
    reserve_v2 = (ROOT / "js" / "pdf-editor" / "page-number-auto-reserve-layout-v2.js").read_text(encoding="utf-8")

    assert "setInterval(" not in live
    assert "setInterval(" not in count
    assert "setInterval(" not in multi
    assert "setInterval(" not in selection
    assert "setInterval(" not in reserve
    assert "setInterval(" not in reserve_v2
    assert "removeAttribute('title')" in count
