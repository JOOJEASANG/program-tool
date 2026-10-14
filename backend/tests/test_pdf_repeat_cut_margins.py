"""Verify cut-piece margins are identical for every 2-up and 4-up repeat."""
from pathlib import Path
import subprocess

import fitz
import pytest

from models.schemas import NupValue, PageInfo, PdfProcessRequest, PageNumberSettings
from services import pdf_engine
from services import pdf_ops


ROOT = Path(__file__).resolve().parents[2]
MM = pdf_ops.MM_TO_PT


@pytest.mark.parametrize(
    "paper, nup, expected",
    [
        ((210, 297), 2, (1, 2)),
        ((297, 210), 2, (2, 1)),
        ((210, 297), 4, (2, 2)),
    ],
)
def test_repeat_cut_layout_has_exact_sheet_divisions_and_independent_margins(paper, nup, expected):
    width, height = paper
    margins = tuple(v * MM for v in (9, 15, 7, 21))  # L/R/T/B intentionally unequal
    layout = pdf_engine._build_repeat_cut_layout(
        nup, width * MM, height * MM, margins,
    )
    cols, rows = expected
    assert (layout.cols, layout.rows) == expected
    assert len(layout.tile_rects) == nup
    for tile, content in zip(layout.tile_rects, layout.cell_rects):
        assert tile.width == pytest.approx(width * MM / cols)
        assert tile.height == pytest.approx(height * MM / rows)
        assert content.x0 - tile.x0 == pytest.approx(margins[0])
        assert tile.x1 - content.x1 == pytest.approx(margins[1])
        assert content.y0 - tile.y0 == pytest.approx(margins[2])
        assert tile.y1 - content.y1 == pytest.approx(margins[3])
    assert {round(t.x0 / (width * MM / cols)) for t in layout.tile_rects} == set(range(cols))
    assert {round(t.y0 / (height * MM / rows)) for t in layout.tile_rects} == set(range(rows))

    # The inside edges meet at the physical centre/cut, not at a shifted gutter.
    if rows == 2:
        upper = min(layout.tile_rects, key=lambda r: r.y0)
        lower = max(layout.tile_rects, key=lambda r: r.y0)
        assert upper.y1 == pytest.approx(height * MM / 2)
        assert lower.y0 == pytest.approx(height * MM / 2)
    if cols == 2:
        left = min(layout.tile_rects, key=lambda r: r.x0)
        right = max(layout.tile_rects, key=lambda r: r.x0)
        assert left.x1 == pytest.approx(width * MM / 2)
        assert right.x0 == pytest.approx(width * MM / 2)


@pytest.mark.parametrize("nup", [NupValue.two, NupValue.four])
def test_rendered_repeat_has_identical_relative_content_positions_in_each_trim_piece(nup):
    source = fitz.open()
    original = source.new_page(width=170, height=230)
    original.insert_text((35, 70), "CUTTEST", fontsize=14)
    request = PdfProcessRequest(
        paper={"width_mm": 210, "height_mm": 297},
        pages=[
            PageInfo(file_index=0, page_index=0, group_break=(copy == 0), nup_override=nup)
            for copy in range(int(nup))
        ],
        nup_default=nup,
        repeat_cell_overlays=True,
        gap_mm=28,  # Must not push trim boundaries away from paper centre.
        margin_left_mm=9,
        margin_right_mm=15,
        margin_top_mm=7,
        margin_bottom_mm=21,
        page_numbers=PageNumberSettings(enabled=False),
    )
    result = pdf_engine.build_pdf_document([source], request)
    try:
        assert result.page_count == 1
        layout = pdf_engine._build_repeat_cut_layout(
            int(nup), 210 * MM, 297 * MM,
            tuple(v * MM for v in (9, 15, 7, 21)),
        )
        text_words = [word for word in result[0].get_text("words") if word[4] == "CUTTEST"]
        assert len(text_words) == int(nup)
        local_positions = []
        for tile in layout.tile_rects:
            matching = [
                word for word in text_words
                if tile.x0 <= word[0] < tile.x1 and tile.y0 <= word[1] < tile.y1
            ]
            assert len(matching) == 1, "each trimmed piece should contain one source"
            local_positions.append((matching[0][0] - tile.x0, matching[0][1] - tile.y0))
        assert max(x for x, _ in local_positions) - min(x for x, _ in local_positions) < 0.15
        assert max(y for _, y in local_positions) - min(y for _, y in local_positions) < 0.15
    finally:
        result.close()
        source.close()


def test_repeat_cut_geometry_matches_browser_and_has_no_page_level_gap():
    result = subprocess.run(
        ["node", str(ROOT / "backend/tests/test_pdf_repeat_cut_margin_geometry.cjs")],
        cwd=ROOT, capture_output=True, text=True, check=False, timeout=30,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "PDF repeat cut-piece margins verified" in result.stdout
