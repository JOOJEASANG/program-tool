import pytest
from pydantic import ValidationError

from models.schemas import PdfProcessRequest


def _request(**overrides):
    payload = {
        "paper": {"width_mm": 210, "height_mm": 297},
        "pages": [
            {"file_index": 0, "page_index": 0, "page_type": "normal"},
            {"file_index": 0, "page_index": 1, "page_type": "normal"},
            {"file_index": 0, "page_index": 2, "page_type": "normal"},
            {"file_index": 0, "page_index": 3, "page_type": "normal"},
        ],
        "nup_default": 2,
        "booklet": True,
    }
    payload.update(overrides)
    return payload


def test_booklet_accepts_supported_nup():
    request = PdfProcessRequest.model_validate(_request())
    assert request.booklet is True
    assert int(request.nup_default) == 2


@pytest.mark.parametrize("nup", [1, 9])
def test_booklet_rejects_unsupported_nup(nup):
    with pytest.raises(ValidationError, match="2, 4, 6, 8-up"):
        PdfProcessRequest.model_validate(_request(nup_default=nup))


@pytest.mark.parametrize(
    "page_change",
    [
        {"nup_override": 4},
        {"nup_disabled": True},
        {"group_break": True},
    ],
)
def test_booklet_keeps_existing_per_page_metadata(page_change):
    payload = _request()
    payload["pages"][1].update(page_change)
    request = PdfProcessRequest.model_validate(payload)

    page = request.pages[1]
    if "nup_override" in page_change:
        assert int(page.nup_override) == page_change["nup_override"]
    if "nup_disabled" in page_change:
        assert page.nup_disabled is True
    if "group_break" in page_change:
        assert page.group_break is True


def test_non_booklet_keeps_existing_page_overrides():
    payload = _request(booklet=False)
    payload["pages"][1]["nup_override"] = 4
    request = PdfProcessRequest.model_validate(payload)
    assert int(request.pages[1].nup_override) == 4
