from pathlib import Path

import pytest

from models.schemas import PdfProcessRequest
from services import pdf_overlay_margin_patch
from services.pdf_ops import MM_TO_PT


ROOT = Path(__file__).resolve().parents[2]
MAIN = ROOT / "backend" / "main.py"
PATCH = ROOT / "backend" / "services" / "pdf_overlay_margin_patch.py"


def _request(**overrides):
    data = {
        "pages": [{"file_index": 0, "page_index": 0}],
        "margin_left_mm": 25,
        "margin_right_mm": 10,
        "margin_top_mm": 10,
        "margin_bottom_mm": 10,
        "facing_pages": True,
    }
    data.update(overrides)
    return PdfProcessRequest.model_validate(data)


def test_header_footer_side_anchors_follow_independent_paper_margins():
    request = _request(facing_pages=False)
    left, right = pdf_overlay_margin_patch._paper_side_anchors(
        request,
        output_page_num=1,
        overlay_margin_pt=5 * MM_TO_PT,
    )
    assert left == pytest.approx(25 * MM_TO_PT)
    assert right == pytest.approx(10 * MM_TO_PT)


def test_facing_pages_swap_header_footer_side_anchors_on_even_output_pages():
    request = _request(facing_pages=True)
    left, right = pdf_overlay_margin_patch._paper_side_anchors(
        request,
        output_page_num=2,
        overlay_margin_pt=5 * MM_TO_PT,
    )
    assert left == pytest.approx(10 * MM_TO_PT)
    assert right == pytest.approx(25 * MM_TO_PT)


def test_center_overlay_rect_uses_the_space_between_left_and_right_margins():
    page_width = 210 * MM_TO_PT
    left = 25 * MM_TO_PT
    right = 10 * MM_TO_PT
    _left_rect, center_rect, _right_rect = pdf_overlay_margin_patch._text_rects(
        page_width,
        left,
        right,
    )
    assert center_rect.x0 == pytest.approx(left)
    assert center_rect.x1 == pytest.approx(page_width - right)


def test_overlay_margin_patch_is_explicitly_activated_without_changing_pdf_loader_count():
    main = MAIN.read_text(encoding="utf-8")
    source = PATCH.read_text(encoding="utf-8")
    loader = (ROOT / "js" / "pdf-editor" / "loader.js").read_text(encoding="utf-8")
    assert "from services import pdf_overlay_margin_patch" in main
    assert "pdf_text_renderer.apply_header_footer = _apply_header_footer_with_paper_margins" in source
    assert "pdf_engine.build_pdf_document = _build_pdf_document_with_overlay_context" in source
    assert loader.count("'/js/pdf-editor/") == 8
