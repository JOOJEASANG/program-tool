import io

import fitz
import pytest

from models.schemas import PageInfo, PdfProcessRequest
from services.pdf_layout_implementation import (
    _booklet_layout,
    _group_booklet_pages,
    process_pdf_with_individual_margins,
)
from services.pdf_ops import BOOKLET_STRIPS, MM_TO_PT, _booklet_reorder


def _logical_pages(count: int, *, conflicting_overrides: bool = False) -> list[PageInfo]:
    pages = []
    for index in range(count):
        pages.append(
            PageInfo(
                file_index=0,
                page_index=index,
                nup_override=1 if conflicting_overrides else None,
                nup_disabled=conflicting_overrides and index % 3 == 0,
                group_break=conflicting_overrides and index % 2 == 1,
            )
        )
    return pages


def _source_pdf(page_count: int) -> bytes:
    doc = fitz.open()
    for index in range(page_count):
        page = doc.new_page(width=210, height=297)
        page.insert_text((30, 60), f"SOURCE-{index + 1}", fontsize=18)
    data = doc.tobytes()
    doc.close()
    return data


def _layout_source_pdf(page_count: int) -> bytes:
    """Create square source pages with a centered token for cell-position checks."""
    doc = fitz.open()
    for index in range(page_count):
        page = doc.new_page(width=200, height=200)
        page.insert_text((78, 106), f"P{index + 1:02d}", fontsize=18)
    data = doc.tobytes()
    doc.close()
    return data


def _request(
    page_count: int,
    nup: int,
    pages: list[dict] | None = None,
    paper: tuple[float, float] = (210, 297),
) -> PdfProcessRequest:
    return PdfProcessRequest.model_validate(
        {
            "pages": pages
            or [
                {"file_index": 0, "page_index": index}
                for index in range(page_count)
            ],
            "nup_default": nup,
            "booklet": True,
            "paper": {"width_mm": paper[0], "height_mm": paper[1]},
            "margin_h_mm": 8,
            "margin_v_mm": 8,
            "gap_mm": 3,
        }
    )


@pytest.mark.parametrize("nup", sorted(BOOKLET_STRIPS))
def test_booklet_imposition_is_complete_for_page_counts_1_to_20(nup: int):
    for page_count in range(1, 21):
        original = _logical_pages(page_count, conflicting_overrides=True)
        imposed = _booklet_reorder(original, nup)
        groups = _group_booklet_pages(imposed, nup)

        assert imposed
        assert len(imposed) % nup == 0
        assert all(len(group) == nup for group in groups)

        original_indexes = sorted(
            page.page_index
            for page in imposed
            if page.page_type != "blank"
        )
        assert original_indexes == list(range(page_count))


@pytest.mark.parametrize(
    ("nup", "expected"),
    [
        (2, (2, 1)),
        (4, (2, 2)),
        (6, (2, 3)),
        (8, (2, 4)),
    ],
)
def test_booklet_layout_is_fixed_to_left_right_pairs(nup: int, expected: tuple[int, int]):
    assert _booklet_layout(nup) == expected


@pytest.mark.parametrize("paper", [(210, 297), (297, 210)])
@pytest.mark.parametrize("nup", sorted(BOOKLET_STRIPS))
def test_booklet_first_side_keeps_two_column_row_major_pairs_for_any_orientation(
    paper: tuple[float, float],
    nup: int,
):
    page_count = nup * 2
    output = process_pdf_with_individual_margins(
        [_layout_source_pdf(page_count)],
        _request(page_count, nup, paper=paper),
    )
    result = fitz.open(stream=output, filetype="pdf")
    try:
        page = result[0]
        words = {
            word[4]: fitz.Rect(word[0], word[1], word[2], word[3])
            for word in page.get_text("words")
            if str(word[4]).startswith("P")
        }
        expected_labels = []
        for strip_index in range(nup // 2):
            expected_labels.extend(
                [f"P{(strip_index + 1) * 4:02d}", f"P{strip_index * 4 + 1:02d}"]
            )

        cols, rows = _booklet_layout(nup)
        margin = 8 * MM_TO_PT
        gap = 3 * MM_TO_PT
        cell_width = (page.rect.width - margin * 2 - gap * (cols - 1)) / cols
        cell_height = (page.rect.height - margin * 2 - gap * (rows - 1)) / rows

        assert set(expected_labels).issubset(words)
        for slot_index, label in enumerate(expected_labels):
            col = slot_index % cols
            row = slot_index // cols
            cell = fitz.Rect(
                margin + col * (cell_width + gap),
                margin + row * (cell_height + gap),
                margin + col * (cell_width + gap) + cell_width,
                margin + row * (cell_height + gap) + cell_height,
            )
            center = fitz.Point(
                (words[label].x0 + words[label].x1) / 2,
                (words[label].y0 + words[label].y1) / 2,
            )
            assert cell.contains(center), (
                f"{paper=} {nup=} {label=} expected slot {slot_index} "
                f"but word center {center} was outside {cell}"
            )
    finally:
        result.close()


def test_booklet_blank_in_first_slot_does_not_hide_real_page():
    output = process_pdf_with_individual_margins(
        [_source_pdf(1)],
        _request(1, 2),
    )
    result = fitz.open(stream=output, filetype="pdf")
    try:
        assert result.page_count == 2
        text = "\n".join(page.get_text() for page in result)
        assert text.count("SOURCE-1") == 1
    finally:
        result.close()


@pytest.mark.parametrize(
    ("page_count", "nup"),
    [(3, 2), (5, 4), (7, 6), (9, 8)],
)
def test_booklet_export_preserves_every_source_page(page_count: int, nup: int):
    output = process_pdf_with_individual_margins(
        [_source_pdf(page_count)],
        _request(page_count, nup),
    )
    result = fitz.open(stream=output, filetype="pdf")
    try:
        text = "\n".join(page.get_text() for page in result)
        for index in range(page_count):
            assert text.count(f"SOURCE-{index + 1}") == 1
    finally:
        result.close()


def test_booklet_ignores_page_overrides_and_group_breaks_for_export():
    page_count = 6
    pages = [
        {
            "file_index": 0,
            "page_index": index,
            "nup_override": 1,
            "nup_disabled": index % 3 == 0,
            "group_break": index % 2 == 1,
        }
        for index in range(page_count)
    ]
    output = process_pdf_with_individual_margins(
        [_source_pdf(page_count)],
        _request(page_count, 4, pages),
    )
    result = fitz.open(stream=output, filetype="pdf")
    try:
        # Six logical pages become two 4-up output sides after booklet padding.
        assert result.page_count == 2
        text = "\n".join(page.get_text() for page in result)
        for index in range(page_count):
            assert f"SOURCE-{index + 1}" in text
    finally:
        result.close()


def test_booklet_can_place_divider_as_a_logical_page():
    pages = [
        {"file_index": 0, "page_index": 0},
        {
            "file_index": 0,
            "page_index": 0,
            "page_type": "divider",
            "nup_disabled": True,
            "divider_content": '{"title":"DIVIDER"}',
            "divider_style": "simple",
        },
        {"file_index": 0, "page_index": 1},
    ]
    output = process_pdf_with_individual_margins(
        [_source_pdf(2)],
        _request(3, 2, pages),
    )
    result = fitz.open(stream=output, filetype="pdf")
    try:
        assert result.page_count == 2
        text = "\n".join(page.get_text() for page in result)
        assert "SOURCE-1" in text
        assert "SOURCE-2" in text
        assert "DIVIDER" in text
    finally:
        result.close()
