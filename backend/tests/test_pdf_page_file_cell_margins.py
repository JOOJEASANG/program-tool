"""Per-page margins override, never add to, the inherited sheet margins."""
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
    assert request.pages[1].content_margin_left_mm is None
    assert request.pages[1].content_margin_right_mm == 20
    assert request.margin_left_mm == 9


def test_content_margin_schema_rejects_negative_or_unbounded_values():
    with pytest.raises(ValueError):
        PageInfo(file_index=0, page_index=0, content_margin_top_mm=-1)
    with pytest.raises(ValueError):
        PageInfo(file_index=0, page_index=0, content_margin_bottom_mm=81)


def test_page_specific_margins_replace_global_offsets_in_nup_cells():
    m = MM_TO_PT
    paper = (210 * m, 297 * m)
    global_margins = (8*m, 9*m, 10*m, 11*m)
    layout = _build_page_layout(2, *paper, global_margins, 5*m)
    pages = [
        PageInfo(file_index=0, page_index=0, content_margin_left_mm=6,
                 content_margin_top_mm=7),
        PageInfo(file_index=1, page_index=0, content_margin_right_mm=13,
                 content_margin_bottom_mm=14),
    ]
    rects = [_page_content_inset_rect(layout.cell_rects[i], pages[i], global_margins) for i in range(2)]
    assert rects[0].x0 == pytest.approx(layout.cell_rects[0].x0 - 2*m)
    assert rects[0].y0 == pytest.approx(layout.cell_rects[0].y0 - 3*m)
    assert rects[1].x1 == pytest.approx(layout.cell_rects[1].x1 - 4*m)
    assert rects[1].y1 == pytest.approx(layout.cell_rects[1].y1 - 3*m)
    assert layout.cell_rects[0].x0 == pytest.approx(8*m)


def test_page_zero_margin_means_zero_not_ten_or_twenty():
    m = MM_TO_PT
    base = (10*m, 10*m, 10*m, 10*m)
    cell = fitz.Rect(10*m, 10*m, 200*m, 287*m)
    selected = PageInfo(file_index=0, page_index=0,
                        content_margin_left_mm=0, content_margin_right_mm=0,
                        content_margin_top_mm=0, content_margin_bottom_mm=0)
    unchanged = PageInfo(file_index=0, page_index=1)
    zero = _page_content_inset_rect(cell, selected, base)
    inherited = _page_content_inset_rect(cell, unchanged, base)
    assert tuple(zero) == pytest.approx((0, 0, 210*m, 297*m))
    assert tuple(inherited) == pytest.approx(tuple(cell))


def test_single_edge_override_keeps_other_edges_inherited():
    m = MM_TO_PT
    cell = fitz.Rect(10*m, 10*m, 200*m, 287*m)
    page = PageInfo(file_index=0, page_index=0, content_margin_left_mm=0)
    rect = _page_content_inset_rect(cell, page, (10*m, 10*m, 10*m, 10*m))
    assert rect.x0 == pytest.approx(0)
    assert rect.x1 == pytest.approx(200*m)
    assert rect.y0 == pytest.approx(10*m)
    assert rect.y1 == pytest.approx(287*m)


def test_too_large_page_content_margin_fails_instead_of_clipping():
    page = PageInfo(file_index=0, page_index=0,
                    content_margin_left_mm=45, content_margin_right_mm=45)
    with pytest.raises(ValueError, match="페이지 개별 여백"):
        _page_content_inset_rect(fitz.Rect(10*MM_TO_PT, 10*MM_TO_PT, 60*MM_TO_PT, 90*MM_TO_PT), page,
                                 (10*MM_TO_PT,)*4)


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
            inside = _page_content_inset_rect(layout.cell_rects[index], request.pages[index],
                                              (8*MM_TO_PT, 8*MM_TO_PT, 10*MM_TO_PT, 10*MM_TO_PT))
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
    assert "cellX + deltaLeft * mm2px" in js
    assert "innerW * mm2px, innerH * mm2px" in js
    assert "settings.pages = settings.pages.map" in js
    for edge in ("left", "right", "top", "bottom"):
        assert "content_margin_" + edge + "_mm: inset." + edge + " ?? null" in js
    assert "state.pageCellMargins = sourcePages().map" in js
    assert "restorePageCellMargins(state)" in js
    assert "Object.keys(pageCellMarginOverrides(page)).length > 0" in js
    assert "const deltaLeft = finalMargins.left - margins.left;" in js
    assert "document.addEventListener('pdf-page-selection-change', queueCellMarginSync);" in js
    route = (ROOT / 'js' / 'pdf-editor' / 'route-runtime.js').read_text(encoding='utf-8')
    assert "if(selectionApp==='layout'){" in route
