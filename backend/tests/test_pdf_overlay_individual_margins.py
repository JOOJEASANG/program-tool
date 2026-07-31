from pathlib import Path

import pytest

from models.schemas import PdfProcessRequest
from services import pdf_text_renderer
from services.pdf_ops import MM_TO_PT


ROOT = Path(__file__).resolve().parents[2]


def _request(**overrides):
    data = {
        "pages": [{"file_index": 0, "page_index": 0}],
        "margin_left_mm": 25,
        "margin_right_mm": 10,
        "margin_top_mm": 10,
        "margin_bottom_mm": 10,
        "facing_pages": True,
        "header_footer": {"enabled": True},
    }
    data.update(overrides)
    return PdfProcessRequest.model_validate(data)


def test_request_copies_independent_paper_margins_to_header_footer_settings():
    request = _request()
    assert request.header_footer.margin_left_mm == 25
    assert request.header_footer.margin_right_mm == 10


def test_legacy_paired_margin_is_used_when_independent_values_are_missing():
    request = _request(
        margin_left_mm=None,
        margin_right_mm=None,
        margin_h_mm=14,
    )
    assert request.header_footer.margin_left_mm == 14
    assert request.header_footer.margin_right_mm == 14


def test_header_footer_paper_margins_swap_on_even_facing_pages():
    settings = _request().header_footer
    odd = pdf_text_renderer._horizontal_paper_margins(settings, True, True)
    even = pdf_text_renderer._horizontal_paper_margins(settings, True, False)
    assert odd == pytest.approx((25 * MM_TO_PT, 10 * MM_TO_PT))
    assert even == pytest.approx((10 * MM_TO_PT, 25 * MM_TO_PT))


def test_center_header_footer_rect_uses_space_between_independent_margins():
    page_width = 210 * MM_TO_PT
    left = 25 * MM_TO_PT
    right = 10 * MM_TO_PT
    _left_rect, center_rect, _right_rect = pdf_text_renderer._horizontal_overlay_rects(
        page_width,
        left,
        right,
    )
    assert center_rect.x0 == pytest.approx(left)
    assert center_rect.x1 == pytest.approx(page_width - right)


def test_explicit_renderer_change_keeps_pdf_loader_at_eight_modules():
    source = (ROOT / "backend" / "services" / "pdf_text_renderer.py").read_text(encoding="utf-8")
    schema = (ROOT / "backend" / "models" / "schemas.py").read_text(encoding="utf-8")
    loader = (ROOT / "js" / "pdf-editor" / "loader.js").read_text(encoding="utf-8")
    assert "def _horizontal_paper_margins" in source
    assert "margin_left_mm: Optional[float]" in schema
    assert "margin_right_mm: Optional[float]" in schema
    assert "ContextVar" not in source
    assert loader.count("'/js/pdf-editor/") == 8
