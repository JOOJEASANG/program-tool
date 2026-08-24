from pathlib import Path

from models.schemas import PageInfo
from services.pdf_ops import _booklet_reorder


ROOT = Path(__file__).resolve().parents[2]


def _page_number(page: PageInfo):
    return None if page.page_type == "blank" else page.page_index + 1


def test_existing_four_up_engine_makes_two_identical_books_when_input_is_duplicated():
    one_book = [PageInfo(file_index=0, page_index=index) for index in range(8)]
    duplicated = one_book + one_book

    imposed = _booklet_reorder(duplicated, 4)
    groups = [
        [_page_number(page) for page in imposed[index:index + 4]]
        for index in range(0, len(imposed), 4)
    ]

    assert groups == [
        [8, 1, 8, 1],
        [2, 7, 2, 7],
        [6, 3, 6, 3],
        [4, 5, 4, 5],
    ]


def test_repeat_two_frontend_duplicates_export_and_preview_without_backend_fork():
    source = (ROOT / "js" / "pdf-editor" / "booklet-repeat-two.js").read_text(encoding="utf-8")
    app_version = (ROOT / "js" / "app-version.js").read_text(encoding="utf-8")

    assert "동일 소책자 2권 반복" in source
    assert "duplicateBookPages" in source
    assert "...source.map(clonePage)" in source
    assert "return original.call(this,duplicateBookPages(pages),4)" in source
    assert "nup_default:4" in source
    assert "pages:duplicateBookPages(pages)" in source
    assert "booklet:true" in source
    assert "가운데 재단" in source
    assert "PdfOutputContract" in source
    assert "pdfBookletRepeatTwoScriptV1" in app_version
    assert "/js/pdf-editor/booklet-repeat-two.js?v=20260825-1" in app_version


def test_repeat_two_mode_forces_four_up_and_turns_off_with_other_nup():
    source = (ROOT / "js" / "pdf-editor" / "booklet-repeat-two.js").read_text(encoding="utf-8")

    assert '.nup-btn[data-nup="4"]' in source
    assert "forceFourUp();" in source
    assert "String(button.dataset.nup)!=='4'" in source
    assert "applyEnabledState(false" in source
