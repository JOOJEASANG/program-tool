"""Full-size saved booklet sheets: zero center gutter, exact per-side millimeters.

The sheet MediaBox is the chosen output paper, not a crop to the source pages.
Test four 2-up output faces from an eight-page PDF, including legacy stored
per-page margin overrides that previously opened an unwanted fold gap.
"""
from pathlib import Path

import fitz
import pytest

from models.schemas import NupValue, PageInfo, PaperSize, PdfProcessRequest
from services.pdf_engine import build_pdf_document
from services.pdf_ops import MM_TO_PT


@pytest.mark.parametrize(
    ("paper_mm", "side_mm"),
    [
        ((420, 297), (105, 148)),  # A3 landscape with A6-ish pages
        ((297, 210), (90, 130)),   # A4 landscape with outer white space
        ((360, 250), (110, 160)),  # custom paper and custom side dimensions
    ],
)
def test_eight_page_booklet_touching_fold_and_preserving_full_paper(
    paper_mm, side_mm
):
    source = fitz.open()
    for i in range(8):
        page = source.new_page(width=150 * MM_TO_PT, height=200 * MM_TO_PT)
        page.insert_text((35, 64), f"BOOKLET-{i + 1}", fontsize=16)

    # These old overrides must not become an inner gutter in booklet mode.
    pages = [
        PageInfo(
            file_index=0, page_index=i,
            content_margin_left_mm=18, content_margin_right_mm=18,
        )
        for i in range(8)
    ]
    request = PdfProcessRequest(
        pages=pages,
        paper=PaperSize(width_mm=paper_mm[0], height_mm=paper_mm[1]),
        nup_default=NupValue(2),
        booklet=True,
        booklet_spine_align=True,
        placement_width_mm=side_mm[0],
        placement_height_mm=side_mm[1],
        margin_h_mm=12,
        margin_v_mm=8,
        gap_mm=20,  # booklet gutter must ignore this value
        add_border=True,
    )

    output = build_pdf_document([source], request)
    try:
        assert output.page_count == 4  # two physical sheets, both sides
        fold_x = paper_mm[0] / 2 * MM_TO_PT
        side_w_pt = side_mm[0] * MM_TO_PT
        side_h_pt = side_mm[1] * MM_TO_PT
        expected_pairs = [(8, 1), (2, 7), (6, 3), (4, 5)]

        for face, logical_pair in zip(output, expected_pairs):
            # MediaBox keeps the exact printer-paper dimensions, including
            # all unused space outside both fitted booklet pages.
            assert face.rect.width == pytest.approx(paper_mm[0] * MM_TO_PT, abs=0.2)
            assert face.rect.height == pytest.approx(paper_mm[1] * MM_TO_PT, abs=0.2)

            labels = {word[4] for word in face.get_text("words")}
            assert f"BOOKLET-{logical_pair[0]}" in labels
            assert f"BOOKLET-{logical_pair[1]}" in labels

            rectangles = [
                rect for item in face.get_drawings()
                if item.get("type") == "s"
                for rect in [item.get("rect")]
                if isinstance(rect, fitz.Rect)
                and abs(rect.width - side_w_pt) < 0.8
                and abs(rect.height - side_h_pt) < 0.8
            ]
            assert len(rectangles) == 2, f"Incorrect page boxes: {rectangles}"
            left, right = sorted(rectangles, key=lambda rect: rect.x0)
            assert left.x1 == pytest.approx(fold_x, abs=0.4)
            assert right.x0 == pytest.approx(fold_x, abs=0.4)
            assert left.x0 == pytest.approx(fold_x - side_w_pt, abs=0.4)
            assert right.x1 == pytest.approx(fold_x + side_w_pt, abs=0.4)
            assert left.y0 == pytest.approx(right.y0, abs=0.4)
            assert left.y1 == pytest.approx(right.y1, abs=0.4)
            assert left.x0 > 0  # unused paper margins are still in the PDF
            assert right.x1 < face.rect.width
    finally:
        output.close()
        source.close()


def test_booklet_browser_preview_and_export_share_zero_gutter_rules():
    root = Path(__file__).resolve().parents[2]
    html = (root / "pdf-editor/index.html").read_text(encoding="utf-8")
    layout = (root / "js/pdf-editor/layout-export.js").read_text(encoding="utf-8")
    controller = (root / "js/pdf-editor/booklet-sheet-preview.js").read_text(encoding="utf-8")
    backend = (root / "backend/services/pdf_engine.py").read_text(encoding="utf-8")

    assert "<summary>한 면(1페이지) 실제 크기 · mm</summary>" in html
    assert 'id="actualWidthMm"' in html and 'id="actualHeightMm"' in html
    assert 'id="bookletPageSizeHint"' in html
    assert "const spine = isBookletLayoutActive(nup);" in html
    assert "return isBookletLayoutActive(nup);" in html
    assert "booklet_spine_align: !!$('bookletCheck')?.checked" in html
    assert "용지 크기와 남는 여백 그대로 저장" in html
    assert "settings.booklet_spine_align = !!$('bookletCheck')?.checked;" in layout
    assert "if (column === 0) finalMargins.right = 0;" in layout
    assert "else finalMargins.left = 0;" in layout
    assert "fold_inner_edge:" in backend
    assert "if name == fold_inner_edge:" in backend
    assert "sizeDetails.open=true;" in controller
    assert "booklet_spine_align:true" in controller
