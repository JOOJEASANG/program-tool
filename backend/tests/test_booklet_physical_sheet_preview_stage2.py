from pathlib import Path

from models.schemas import PageInfo
from services.pdf_ops import _booklet_reorder


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def page_numbers(items):
    result = []
    for item in items:
        if item.page_type == "blank":
            result.append(None)
        else:
            result.append(item.page_index + 1)
    return result


def test_two_up_booklet_output_sides_pair_into_real_sheets():
    pages = [PageInfo(file_index=0, page_index=index) for index in range(8)]
    imposed = _booklet_reorder(pages, 2)

    assert page_numbers(imposed) == [8, 1, 2, 7, 6, 3, 4, 5]
    sides = [page_numbers(imposed[index:index + 2]) for index in range(0, len(imposed), 2)]
    assert sides == [[8, 1], [2, 7], [6, 3], [4, 5]]
    sheets = [(sides[index], sides[index + 1]) for index in range(0, len(sides), 2)]
    assert sheets == [
        ([8, 1], [2, 7]),
        ([6, 3], [4, 5]),
    ]


def test_four_up_booklet_keeps_two_strips_on_same_physical_sheet():
    pages = [PageInfo(file_index=0, page_index=index) for index in range(8)]
    imposed = _booklet_reorder(pages, 4)
    sides = [page_numbers(imposed[index:index + 4]) for index in range(0, len(imposed), 4)]

    assert sides == [
        [4, 1, 8, 5],
        [2, 3, 6, 7],
    ]
    assert len(sides) == 2  # front + back = one physical sheet


def test_booklet_padding_is_visible_as_blank_slots():
    pages = [PageInfo(file_index=0, page_index=index) for index in range(5)]
    imposed = _booklet_reorder(pages, 2)

    assert page_numbers(imposed) == [None, 1, 2, None, None, 3, 4, 5]
    assert sum(item.page_type == "blank" for item in imposed) == 3


def test_frontend_sheet_preview_uses_the_existing_imposition_and_real_canvases():
    source = read("js/pdf-editor/booklet-sheet-preview.js")
    app_version = read("js/app-version.js")
    runtime = read("js/sw-register.js")

    assert "physical-booklet-sheet-preview-v1" in source
    assert "bookletReorderPreview(active,nupValue)" in source
    assert "for(let i=0;i<sides.length;i+=2)" in source
    assert "clonePreviewCanvas(previews[side.index])" in source
    assert "실제 용지 앞·뒷면" in source
    assert "실제 종이 ${plan.sheets.length}장" in source
    assert "빈쪽 ${plan.blankCount}쪽" in source
    assert "프린터의 긴변/짧은변 넘김 설정" in source
    assert "if(eventsBound)return" in source
    assert "/js/pdf-editor/booklet-sheet-preview.js?v=20260825-1" in app_version
    assert "/js/pdf-editor/booklet-sheet-preview.js?v=20260825-1" in runtime
