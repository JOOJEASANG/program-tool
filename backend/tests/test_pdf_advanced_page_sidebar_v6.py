from pathlib import Path

import fitz
import pytest

from models.advanced_schemas import AdvancedPageInfo
from services import pdf_ops
from services.pdf_advanced_sheet_layout import _crop_mark_trim_rect


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_page_sidebar_uses_thumbnail_caption_only_and_navigation_on_top():
    facing = read("js/pdf-editor-advanced/facing-upload.js")
    sidebar = read("js/pdf-editor-advanced/workspace-page-sidebar-v7.js")
    html = read("pdf-editor-advanced/index.html")

    assert "import './workspace-page-sidebar-v7.js';" in facing
    assert "page-section>.pair-nav" in sidebar
    assert "titleRow.insertAdjacentElement('afterend', nav)" in sidebar
    assert ".page-item-info span{display:none!important}" in sidebar
    assert "#selectionLabel{display:none!important}" in sidebar
    assert "MutationObserver" not in sidebar
    assert "facing-upload.js?v=20261001-4" in html


def test_trim_size_is_sent_to_output_and_preview_marks_follow_trim_guide():
    sidebar = read("js/pdf-editor-advanced/workspace-page-sidebar-v7.js")
    state = read("js/pdf-editor-advanced/state.js")
    schema = read("backend/models/advanced_schemas.py")
    service = read("backend/services/pdf_advanced_sheet_layout.py")

    assert "advanced-trim-crop-mark" in sidebar
    assert "advancedTrimWidth" in sidebar and "advancedTrimHeight" in sidebar
    assert "trim_width_mm" in state and "trim_height_mm" in state
    assert "trim_width_mm" in schema and "trim_height_mm" in schema
    assert "_crop_mark_trim_rect" in service
    assert "_draw_crop_marks(out_page, _crop_mark_trim_rect(trim, page_info), page_info)" in service


def test_crop_mark_trim_rect_uses_physical_trim_size_centered_on_placed_content():
    page_info = AdvancedPageInfo(
        file_index=0,
        page_index=0,
        trim_width_mm=148,
        trim_height_mm=210,
    )
    content_rect = fitz.Rect(50, 40, 650, 840)
    trim = _crop_mark_trim_rect(content_rect, page_info)

    assert trim.width == pytest.approx(148 * pdf_ops.MM_TO_PT)
    assert trim.height == pytest.approx(210 * pdf_ops.MM_TO_PT)
    assert (trim.x0 + trim.x1) / 2 == pytest.approx((content_rect.x0 + content_rect.x1) / 2)
    assert (trim.y0 + trim.y1) / 2 == pytest.approx((content_rect.y0 + content_rect.y1) / 2)
