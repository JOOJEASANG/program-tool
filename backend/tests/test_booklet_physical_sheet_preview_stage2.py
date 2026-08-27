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


def test_backend_keeps_legacy_four_up_engine_compatibility():
    pages = [PageInfo(file_index=0, page_index=index) for index in range(8)]
    imposed = _booklet_reorder(pages, 4)
    sides = [page_numbers(imposed[index:index + 4]) for index in range(0, len(imposed), 4)]

    assert sides == [
        [4, 1, 8, 5],
        [2, 3, 6, 7],
    ]


def test_booklet_padding_is_visible_as_blank_slots():
    pages = [PageInfo(file_index=0, page_index=index) for index in range(5)]
    imposed = _booklet_reorder(pages, 2)

    assert page_numbers(imposed) == [None, 1, 2, None, None, 3, 4, 5]
    assert sum(item.page_type == "blank" for item in imposed) == 3


def test_frontend_booklet_is_classic_two_page_mode_only():
    source = read("js/pdf-editor/booklet-sheet-preview.js")
    app_version = read("js/app-version.js")
    runtime = read("js/sw-register.js")
    editor = read("pdf-editor/index.html")

    assert "classic-booklet-only-v2" in source
    assert "const BOOKLET_NUP=2" in source
    assert "bookletReorderPreview(active,BOOKLET_NUP)" in source
    assert "nup_default:BOOKLET_NUP" in source
    assert "html.pdf-classic-booklet-active #nupGrid{display:none!important}" in source
    assert "소책자 · 좌/우 2쪽 · 앞/뒤 한 장" in source
    assert "소책자 전용" in source
    assert "실제 소책자 용지 앞·뒷면" in source
    assert "for(let i=0;i<sides.length;i+=2)" in source
    assert "clonePreviewCanvas(previews[side.index])" in source

    # Normal print layout remains available unchanged when booklet is off.
    for value in (1, 2, 4, 6, 8, 9):
        assert f'data-nup="{value}"' in editor

    assert "/js/pdf-editor/booklet-sheet-preview.js?v=20260827-1" in app_version
    assert "/js/pdf-editor/booklet-sheet-preview.js?v=20260825-1" in runtime
