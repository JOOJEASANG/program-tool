from models.schemas import PageInfo
from services import pdf_ops


def _page(index: int, **kwargs) -> PageInfo:
    return PageInfo(file_index=0, page_index=index, **kwargs)


def test_group_by_nup_respects_page_override_and_break():
    pages = [
        _page(0),
        _page(1, nup_override=4),
        _page(2, nup_override=4),
        _page(3, nup_override=4, group_break=True),
    ]

    groups = pdf_ops._group_by_nup(pages, default_nup=2)

    assert [[page.page_index for page in group] for group in groups] == [
        [0],
        [1, 2],
        [3],
    ]


def test_blank_or_divider_page_is_always_isolated_when_nup_disabled():
    pages = [
        _page(0),
        _page(0, page_type="blank", nup_disabled=True),
        _page(1),
        _page(0, page_type="divider", nup_disabled=True, divider_content='{"title":"간지"}'),
    ]

    groups = pdf_ops._group_by_nup(pages, default_nup=2)

    assert len(groups) == 4
    assert groups[1][0].page_type == "blank"
    assert groups[3][0].page_type == "divider"


def test_booklet_reorder_for_four_pages():
    pages = [_page(index) for index in range(4)]

    reordered = pdf_ops._booklet_reorder(pages, nup=2)

    assert [page.page_index for page in reordered] == [3, 0, 1, 2]


def test_booklet_reorder_pads_to_printable_signature():
    pages = [_page(index) for index in range(5)]

    reordered = pdf_ops._booklet_reorder(pages, nup=2)

    assert len(reordered) == 8
    originals = sorted(
        page.page_index
        for page in reordered
        if page.page_type != "blank"
    )
    assert originals == [0, 1, 2, 3, 4]
