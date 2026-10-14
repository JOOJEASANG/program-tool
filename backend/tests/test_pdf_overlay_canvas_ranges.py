"""Canvas-output overlay ranges are independent of input PDF page numbers."""
import fitz
import pytest
from pydantic import ValidationError

from models.schemas import HeaderFooterSection, HeaderFooterSettings, PageNumberSettings
from services.pdf_text_renderer import (
    _page_number_applies,
    apply_header_footer,
    apply_page_numbers,
    page_number_value,
)


def _text(page):
    return page.get_text().strip()


def test_page_number_range_starts_at_one_on_third_output_canvas():
    settings = PageNumberSettings(
        enabled=True, start_page=3, end_page=5, start=1, format="1/N"
    )
    document = fitz.open()
    for index in range(6):
        page = document.new_page(width=300, height=420)
        apply_page_numbers(page, settings, index, 6, 300, 420)
    assert _text(document[0]) == ""
    assert _text(document[1]) == ""
    assert "1/3" in _text(document[2])
    assert "2/3" in _text(document[3])
    assert "3/3" in _text(document[4])
    assert _text(document[5]) == ""


def test_open_ended_page_number_range_and_existing_cover_exclusion():
    settings = PageNumberSettings(enabled=True, start=1, start_page=3)
    assert [_page_number_applies(settings, index) for index in range(5)] == [
        False, False, True, True, True,
    ]
    assert page_number_value(settings, 2, 5) == (1, 3)
    assert page_number_value(settings, 4, 5) == (3, 3)
    legacy = PageNumberSettings(enabled=True, exclude_first=True, start=1)
    assert not _page_number_applies(legacy, 0)
    assert page_number_value(legacy, 1, 5) == (1, 4)


def test_header_footer_range_and_override_use_output_canvas_numbering():
    settings = HeaderFooterSettings(
        enabled=True, header_center="Default {n}/{total}",
        start_page=3, end_page=4,
        sections=[HeaderFooterSection(ranges="4", header_center="Special {n}/{total}")],
    )
    document = fitz.open()
    for number in range(1, 6):
        page = document.new_page(width=300, height=420)
        apply_header_footer(page, settings, 300, 420, number, 5)
    assert _text(document[0]) == ""
    assert _text(document[1]) == ""
    assert "Default 1/2" in _text(document[2])
    assert "Special 2/2" in _text(document[3])
    assert _text(document[4]) == ""


@pytest.mark.parametrize("settings", [
    {"start_page": 4, "end_page": 3},
    {"start_page": 0},
    {"end_page": -1},
])
def test_invalid_canvas_range_is_rejected(settings):
    with pytest.raises(ValidationError):
        PageNumberSettings(**settings)
    with pytest.raises(ValidationError):
        HeaderFooterSettings(**settings)


def test_frontend_output_canvas_ranges_are_exported_and_restored():
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    source = (root / "pdf-editor" / "index.html").read_text(encoding="utf-8")
    reserve = (root / "js" / "pdf-editor" / "layout-export.js").read_text(encoding="utf-8")
    for ident in ("hfStartPage", "hfEndPage", "pnStartPage", "pnEndPage"):
        assert f'id="{ident}"' in source
        assert f"$('"+ident+"')" in source or f"$(prefix + '" in source
    assert "function canvasOverlayRange(" in source
    assert "start_page: hfStartPage" in source
    assert "end_page: hfEndPage" in source
    assert "start_page: pnStartPage" in source
    assert "end_page: pnEndPage" in source
    assert "hfStartPage, hfEndPage" in source
    assert "pnStartPage, pnEndPage" in source
    assert "state.hfStartPage" in source
    assert "state.pnStartPage" in source
    assert "pnStartPage', 'pnEndPage" in reserve
