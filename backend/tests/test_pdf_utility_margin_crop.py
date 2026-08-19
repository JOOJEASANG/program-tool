import fitz

from routers.pdf_utility_margin_crop import _crop_document_pages


def test_margin_crop_reduces_page_visible_size_by_requested_mm():
    document = fitz.open()
    page = document.new_page(width=595.2756, height=841.8898)  # A4 in points

    _crop_document_pages(
        document,
        {"top": 10.0, "bottom": 10.0, "left": 5.0, "right": 5.0},
    )

    crop = page.cropbox
    assert abs(crop.width - (595.2756 - 10.0 * 72 / 25.4)) < 0.01
    assert abs(crop.height - (841.8898 - 20.0 * 72 / 25.4)) < 0.01
    document.close()


def test_margin_crop_rejects_margins_larger_than_page():
    document = fitz.open()
    page = document.new_page(width=100, height=100)

    try:
        try:
            _crop_document_pages(
                document,
                {"top": 80.0, "bottom": 80.0, "left": 0.0, "right": 0.0},
            )
            raise AssertionError("Expected oversized margins to fail")
        except ValueError as exc:
            assert "페이지 크기" in str(exc)
    finally:
        document.close()
