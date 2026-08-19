import fitz

from routers.pdf_utility_margin_crop import _remove_margin_content


def test_margin_removal_keeps_original_page_size():
    document = fitz.open()
    page = document.new_page(width=595.2756, height=841.8898)  # A4 in points
    original = page.rect

    _remove_margin_content(
        document,
        {"top": 10.0, "bottom": 10.0, "left": 5.0, "right": 5.0},
    )

    assert abs(page.rect.width - original.width) < 0.01
    assert abs(page.rect.height - original.height) < 0.01
    document.close()


def test_margin_removal_rejects_margins_larger_than_page():
    document = fitz.open()
    page = document.new_page(width=100, height=100)

    try:
        try:
            _remove_margin_content(
                document,
                {"top": 80.0, "bottom": 80.0, "left": 0.0, "right": 0.0},
            )
            raise AssertionError("Expected oversized margins to fail")
        except ValueError as exc:
            assert "페이지 크기" in str(exc)
    finally:
        document.close()
