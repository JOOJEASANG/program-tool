import base64
import json
from pathlib import Path

import fitz

from services import pdf_divider_renderer


ROOT = Path(__file__).resolve().parents[2]
RENDERER = ROOT / "backend" / "services" / "pdf_divider_renderer.py"


def _valid_png_bytes() -> bytes:
    image_doc = fitz.open()
    try:
        page = image_doc.new_page(width=24, height=24)
        page.draw_rect(page.rect, color=None, fill=(0.12, 0.35, 0.72), overlay=True)
        return page.get_pixmap(alpha=False).tobytes("png")
    finally:
        image_doc.close()


def _data_url(raw: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(raw).decode("ascii")


def test_renderer_accepts_only_inline_user_image_data():
    source = RENDERER.read_text(encoding="utf-8")
    for marker in (
        "MAX_LOCAL_IMAGE_BYTES",
        "LOCAL_IMAGE_DATA_RE",
        'content.get("localImageDataUrl")',
        "base64.b64decode",
        "validate=True",
        "page.insert_image",
    ):
        assert marker in source
    for forbidden in (
        "cover_templates",
        "service-image-v2",
        "serviceImageId",
        "serviceImagePath",
        "firebase_admin",
        "fa_storage",
        "fa_firestore",
    ):
        assert forbidden not in source


def test_divider_renderer_embeds_user_uploaded_image_before_text():
    png_bytes = _valid_png_bytes()
    content = json.dumps(
        {
            "title": "간지",
            "fg": "#ffffff",
            "localImageDataUrl": _data_url(png_bytes),
            "localImageName": "my-divider.png",
        },
        ensure_ascii=False,
    )
    doc = fitz.open()
    try:
        pdf_divider_renderer.render_divider_page(
            doc,
            content,
            "simple",
            210 * 72 / 25.4,
            297 * 72 / 25.4,
        )
        assert doc.page_count == 1
        assert len(doc[0].get_images(full=True)) == 1
    finally:
        doc.close()


def test_invalid_inline_image_is_ignored_safely():
    assert pdf_divider_renderer._local_image_bytes({"localImageDataUrl": "https://example.com/a.png"}) is None
    assert pdf_divider_renderer._local_image_bytes({"localImageDataUrl": "data:image/gif;base64,AAAA"}) is None
    assert pdf_divider_renderer._local_image_bytes({"localImageDataUrl": "data:image/png;base64,%%%"}) is None

    doc = fitz.open()
    try:
        pdf_divider_renderer.render_divider_page(
            doc,
            '{"title":"기본 간지","noBg":false,"bg":"#12396d","fg":"#ffffff","localImageDataUrl":"https://example.com/a.png"}',
            "simple",
            210 * 72 / 25.4,
            297 * 72 / 25.4,
        )
        assert doc.page_count == 1
        assert len(doc[0].get_images(full=True)) == 0
    finally:
        doc.close()
