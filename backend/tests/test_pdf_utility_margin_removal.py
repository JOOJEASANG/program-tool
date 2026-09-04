from pathlib import Path

import fitz

from routers.pdf_utility_margin_crop import _remove_margin_content


ROOT = Path(__file__).resolve().parents[2]


def test_margin_removal_keeps_page_size_and_whites_requested_content():
    document = fitz.open()
    page = document.new_page(width=595.2756, height=841.8898)  # A4 points
    page.draw_rect(fitz.Rect(0, 0, page.rect.width, page.rect.height), color=(1, 0, 0), fill=(1, 0, 0))

    original_width = page.rect.width
    original_height = page.rect.height
    _remove_margin_content(
        document,
        {"top": 10.0, "bottom": 10.0, "left": 5.0, "right": 5.0},
    )

    assert abs(page.rect.width - original_width) < 0.01
    assert abs(page.rect.height - original_height) < 0.01
    pixmap = page.get_pixmap()
    assert pixmap.pixel(5, 20) == (255, 255, 255)
    assert pixmap.pixel(pixmap.width // 2, pixmap.height // 2) == (255, 0, 0)
    document.close()


def test_zero_margins_do_not_change_page_content():
    document = fitz.open()
    page = document.new_page(width=200, height=200)
    page.draw_rect(fitz.Rect(0, 0, 200, 200), color=(0, 0, 1), fill=(0, 0, 1))
    before = page.get_pixmap().pixel(5, 5)

    _remove_margin_content(
        document,
        {"top": 0.0, "bottom": 0.0, "left": 0.0, "right": 0.0},
    )

    assert page.rect.width == 200
    assert page.rect.height == 200
    assert page.get_pixmap().pixel(5, 5) == before
    document.close()


def test_background_margin_ui_uses_pdf_utility_selected_file_state():
    script = (ROOT / "js" / "pdf-utility-margin-crop.js").read_text(encoding="utf-8")
    runtime = (ROOT / "js" / "pdf-preflight" / "route-runtime.js").read_text(encoding="utf-8")

    assert "window.PdfUtility?.state" in script
    assert "state.files[index]" in script
    assert "fileInput" not in script
    assert "background-cleanup-crop-storage" in script
    assert "margin_top_mm" in script
    assert "margin_bottom_mm" in script
    assert "margin_left_mm" in script
    assert "margin_right_mm" in script
    assert "페이지 크기는 그대로 유지" in script
    assert "pdfUtilityBackgroundMarginScriptV2" in runtime
    assert "/js/pdf-utility-margin-crop.js?v=20260904-2" in runtime
