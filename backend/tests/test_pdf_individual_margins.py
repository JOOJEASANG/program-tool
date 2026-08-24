from pathlib import Path
from types import SimpleNamespace

import pytest

from models.schemas import PdfProcessRequest
from services.pdf_engine import (
    _base_layout_margins,
    _build_page_layout,
    _resolve_layout_margins,
)
from services.pdf_ops import MM_TO_PT
from services.pdf_text_renderer import page_number_value


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
LAYOUT_EXPORT = ROOT / "js" / "pdf-editor" / "layout-export.js"
EDITOR = ROOT / "pdf-editor" / "index.html"
LEGACY_EDITOR = ROOT / "tools" / "pdf-editor.html"


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
    odd = _base_layout_margins(request, 0)
    even = _base_layout_margins(request, 1)

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
    assert _base_layout_margins(request, 0) == pytest.approx(
        (14 * MM_TO_PT, 14 * MM_TO_PT, 9 * MM_TO_PT, 9 * MM_TO_PT)
    )


def test_backend_cell_rect_uses_each_paper_edge_margin():
    paper_w = 210 * MM_TO_PT
    paper_h = 297 * MM_TO_PT
    margins = (25 * MM_TO_PT, 10 * MM_TO_PT, 12 * MM_TO_PT, 8 * MM_TO_PT)
    layout = _build_page_layout(1, paper_w, paper_h, margins, 5 * MM_TO_PT)
    rect = layout.cell_rects[0]

    assert rect.x0 == pytest.approx(margins[0])
    assert rect.y0 == pytest.approx(margins[2])
    assert rect.x1 == pytest.approx(paper_w - margins[1])
    assert rect.y1 == pytest.approx(paper_h - margins[3])


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
    assert page_number_value(settings, 1, 6) == (1, 5)
    assert page_number_value(settings, 5, 6) == (5, 5)


def test_independent_margin_ui_is_integrated_into_the_existing_export_module():
    loader = LOADER.read_text(encoding="utf-8")
    source = LAYOUT_EXPORT.read_text(encoding="utf-8")

    assert loader.count("'/js/pdf-editor/") == 8
    assert "individual-margins-facing-pages.js" not in loader
    assert "layout-export.js?v=20260731-3" in loader
    assert "__pdfEditorLayoutExportV8" in source
    assert "individualPaperMarginsV2" in source
    for field in ("marginLeft", "marginRight", "marginTop", "marginBottom"):
        assert field in source
    assert "짝수 출력면은 좌·우 여백을 자동으로 서로 바꿉니다." in source
    assert "setInterval(" not in source


def test_preview_uses_output_index_for_facing_page_margin_swapping():
    source = LAYOUT_EXPORT.read_text(encoding="utf-8")

    assert "function effectiveMargins(outputPageIndex)" in source
    assert "Number(outputPageIndex) % 2 === 1" in source
    assert "output.dataset.marginLeftMm" in source
    assert "output.dataset.marginRightMm" in source
    assert "output.length," in source
    assert "buildOutputPage = patchedBuildOutputPage" in source
    assert "buildAllPages = patchedBuildAllPages" in source


def test_preview_page_number_reserve_matches_backend_formula_contract():
    source = LAYOUT_EXPORT.read_text(encoding="utf-8")

    assert "const PT_TO_MM = 25.4 / 72" in source
    assert "const PAGE_NUMBER_MIN_FONT_PT = 5" in source
    assert "const PAGE_NUMBER_MAX_FONT_PT = 72" in source
    assert "const PAGE_NUMBER_HEIGHT_FACTOR = 1.8" in source
    assert "const PAGE_NUMBER_PADDING_MM = 2" in source
    assert "function requiredPageNumberSpaceMm(edgeMargin)" in source
    assert "const anchor = Math.max(paperEdge, dedicated)" in source
    assert "fontSize * PT_TO_MM * PAGE_NUMBER_HEIGHT_FACTOR + PAGE_NUMBER_PADDING_MM" in source
    assert "Math.min(\n      80," in source


def test_preview_reserves_only_for_the_same_output_pages_as_backend():
    source = LAYOUT_EXPORT.read_text(encoding="utf-8")

    assert "function pageNumberApplies(outputPageIndex)" in source
    assert "excludeFirst && index === 0" in source
    assert "applyTo === 'odd' && isOddPage" in source
    assert "applyTo === 'even' && !isOddPage" in source
    assert "pageNumberPosition().startsWith('top-')" in source
    assert "margins.top = requiredPageNumberSpaceMm(margins.top)" in source
    assert "margins.bottom = requiredPageNumberSpaceMm(margins.bottom)" in source
    assert "let margins = layoutMargins(resolvedOutputIndex)" in source
    assert "output.dataset.pageNumberAutoReserve" in source


def test_page_number_auto_reserve_ui_export_and_session_share_one_setting():
    source = LAYOUT_EXPORT.read_text(encoding="utf-8")

    assert "id=\"pnAutoReserve\" checked" in source
    assert "페이지 번호 공간 자동 확보" in source
    assert "settings.page_numbers.auto_reserve_space = pageNumberAutoReserveEnabled()" in source
    assert "state.pnAutoReserve = pageNumberAutoReserveEnabled()" in source
    assert "const savedReserve = state.pnAutoReserve ?? state.page_numbers?.auto_reserve_space" in source
    assert "reserveInput.checked = savedReserve !== false" in source


def test_page_number_reserve_does_not_reactivate_legacy_wrapper_modules():
    loader = LOADER.read_text(encoding="utf-8")
    source = LAYOUT_EXPORT.read_text(encoding="utf-8")

    assert loader.count("'/js/pdf-editor/") == 8
    assert "page-number-auto-reserve.js" not in loader
    assert "page-number-auto-reserve-layout-v2.js" not in loader
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_export_and_saved_sessions_keep_all_four_margin_values():
    source = LAYOUT_EXPORT.read_text(encoding="utf-8")

    for field in ("margin_left_mm", "margin_right_mm", "margin_top_mm", "margin_bottom_mm"):
        assert field in source
    for field in ("state.marginLeft", "state.marginRight", "state.marginTop", "state.marginBottom"):
        assert field in source
    assert "collectWithMargins.__individualMarginsV2" in source
    assert "loadWithMargins.__individualMarginsV2" in source
    assert "parsedPages !== previousPages" in source


def test_preview_invalid_geometry_fallback_matches_backend_point_constants():
    source = LAYOUT_EXPORT.read_text(encoding="utf-8")

    assert "const PT_TO_MM = 25.4 / 72" in source
    assert "const FALLBACK_MARGIN_MM = 10 * PT_TO_MM" in source
    assert "const FALLBACK_GAP_MM = 6 * PT_TO_MM" in source
    assert "let layoutGap = gp" in source
    assert "layoutGap = FALLBACK_GAP_MM" in source
    assert "cellW + layoutGap" in source
    assert "cellH + layoutGap" in source
    assert "output.dataset.gapMm = String(layoutGap)" in source


def test_session_restore_synchronizes_facing_state_and_checkbox():
    source = LAYOUT_EXPORT.read_text(encoding="utf-8")

    assert "const savedFacing = state.facingPages ?? state.facing_pages" in source
    assert "facingInput.checked = savedFacing" in source
    assert "facingPages = savedFacing" in source
    apply_start = source.index("function applyStateMargins")
    assert source.index("facingInput.checked = savedFacing", apply_start) < source.index(
        "updateFacingNote();", apply_start
    )


def test_legacy_pdf_editor_entrypoint_redirects_to_canonical_editor():
    legacy = LEGACY_EDITOR.read_text(encoding="utf-8")
    assert EDITOR.read_text(encoding="utf-8") != legacy
    assert 'http-equiv="refresh"' in legacy
    assert "/pdf-editor/" in legacy
    assert "location.replace" in legacy
    assert "location.search+location.hash" in legacy
