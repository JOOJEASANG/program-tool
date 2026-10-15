"""Additional source-page whitespace is independent of sheet margins and N-up grouping."""
from pathlib import Path

import fitz
import pytest

from models.schemas import NupValue, PageInfo, PaperSize, PdfProcessRequest
from services.pdf_engine import _build_page_layout, _page_content_inset_rect, build_pdf_document
from services.pdf_ops import MM_TO_PT


ROOT = Path(__file__).resolve().parents[2]


def test_independent_content_margins_are_accepted_per_page():
    request = PdfProcessRequest(
        pages=[
            PageInfo(file_index=0, page_index=0, content_margin_left_mm=12),
            PageInfo(file_index=1, page_index=0, content_margin_right_mm=20),
        ],
        margin_left_mm=9,
        margin_right_mm=7,
        margin_top_mm=8,
        margin_bottom_mm=6,
    )
    assert request.pages[0].content_margin_left_mm == 12
    assert request.pages[1].content_margin_left_mm == 0
    assert request.pages[1].content_margin_right_mm == 20
    assert request.margin_left_mm == 9


def test_content_margin_schema_rejects_negative_or_unbounded_values():
    with pytest.raises(ValueError):
        PageInfo(file_index=0, page_index=0, content_margin_top_mm=-1)
    with pytest.raises(ValueError):
        PageInfo(file_index=0, page_index=0, content_margin_bottom_mm=81)


def test_content_inset_is_relative_to_each_cell_not_the_paper():
    m = MM_TO_PT
    paper = (210 * m, 297 * m)
    layout = _build_page_layout(2, *paper, (8*m, 9*m, 10*m, 11*m), 5*m)
    pages = [
        PageInfo(file_index=0, page_index=0, content_margin_left_mm=6,
                 content_margin_top_mm=7),
        PageInfo(file_index=1, page_index=0, content_margin_right_mm=13,
                 content_margin_bottom_mm=14),
    ]
    rects = [_page_content_inset_rect(layout.cell_rects[i], pages[i]) for i in range(2)]
    assert rects[0].x0 == pytest.approx(layout.cell_rects[0].x0 + 6*m)
    assert rects[0].y0 == pytest.approx(layout.cell_rects[0].y0 + 7*m)
    assert rects[1].x1 == pytest.approx(layout.cell_rects[1].x1 - 13*m)
    assert rects[1].y1 == pytest.approx(layout.cell_rects[1].y1 - 14*m)
    assert layout.cell_rects[0].x0 == pytest.approx(8*m)


def test_too_large_page_content_margin_fails_instead_of_clipping():
    page = PageInfo(file_index=0, page_index=0,
                    content_margin_left_mm=45, content_margin_right_mm=45)
    with pytest.raises(ValueError, match="페이지 개별 내용 여백"):
        _page_content_inset_rect(fitz.Rect(0, 0, 70*MM_TO_PT, 100*MM_TO_PT), page)


def test_rendered_two_up_pdf_keeps_distinct_per_page_content_insets():
    document = fitz.open()
    for label in ("FIRST", "SECOND"):
        p = document.new_page(width=170, height=190)
        p.insert_text((30, 60), label, fontsize=18)
    request = PdfProcessRequest(
        pages=[
            PageInfo(file_index=0, page_index=0, content_margin_left_mm=13,
                     content_margin_top_mm=9),
            PageInfo(file_index=0, page_index=1, content_margin_right_mm=17,
                     content_margin_bottom_mm=11),
        ],
        paper=PaperSize(width_mm=210, height_mm=297),
        nup_default=NupValue(2),
        margin_left_mm=8, margin_right_mm=8,
        margin_top_mm=10, margin_bottom_mm=10,
    )
    result = build_pdf_document([document], request)
    try:
        assert result.page_count == 1
        words = {word[4]: fitz.Rect(word[:4]) for word in result[0].get_text("words")}
        assert "FIRST" in words and "SECOND" in words
        layout = _build_page_layout(2, 210*MM_TO_PT, 297*MM_TO_PT,
                                    (8*MM_TO_PT, 8*MM_TO_PT, 10*MM_TO_PT, 10*MM_TO_PT), 5*MM_TO_PT)
        for index, label in enumerate(("FIRST", "SECOND")):
            inside = _page_content_inset_rect(layout.cell_rects[index], request.pages[index])
            assert inside.intersects(words[label])
            assert inside.contains(words[label].tl)
    finally:
        result.close()
        document.close()


def test_frontend_selection_file_scope_preview_export_and_session_contract():
    js = (ROOT / "js" / "pdf-editor" / "layout-export.js").read_text(encoding="utf-8")
    assert "페이지/파일별 내용 여백 (mm)" in js
    assert "window.PdfEditorPageSelection?.snapshotSelectedIds?.()" in js
    assert "fileSourcePages(Number(match[1]))" in js
    assert "cellX + inset.left * mm2px" in js
    assert "innerW * mm2px, innerH * mm2px" in js
    assert "settings.pages = settings.pages.map" in js
    for edge in ("left", "right", "top", "bottom"):
        assert "content_margin_" + edge + "_mm: inset." + edge in js
    assert "state.pageCellMargins = sourcePages().map" in js
    assert "restorePageCellMargins(state)" in js
