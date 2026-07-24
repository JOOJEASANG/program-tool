import io

import fitz
import pytest

from models.schemas import PageInfo, PdfProcessRequest
from services.pdf_individual_margin_patch import (
    _group_booklet_pages,
    process_pdf_with_individual_margins,
)
from services.pdf_ops import BOOKLET_STRIPS, _booklet_reorder


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


def _request(page_count: int, nup: int, pages: list[dict] | None = None) -> PdfProcessRequest:
    return PdfProcessRequest.model_validate(
        {
            "pages": pages
            or [
                {"file_index": 0, "page_index": index}
                for index in range(page_count)
            ],
            "nup_default": nup,
            "booklet": True,
            "paper": {"width_mm": 210, "height_mm": 297},
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
