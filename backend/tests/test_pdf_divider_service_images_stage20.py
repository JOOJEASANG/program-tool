import base64
from pathlib import Path

import fitz

from services import pdf_divider_renderer


ROOT = Path(__file__).resolve().parents[2]
RENDERER = ROOT / "backend" / "services" / "pdf_divider_renderer.py"

# 1x1 opaque PNG, enough to verify that a divider embeds a raster image.
PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nXQAAAAASUVORK5CYII="
)


def test_service_image_loader_requires_exact_public_pdf_divider_document_contract():
    source = RENDERER.read_text(encoding="utf-8")
    for marker in (
        "SERVICE_IMAGE_PATH_RE",
        "match.group(1) != image_id",
        'collection("cover_templates").document(image_id).get()',
        'data.get("kind") != "service-image-v2"',
        'data.get("isPublic") is not True',
        '"pdf-divider" not in targets',
        'str(data.get("imagePath") or "") != image_path',
        "MAX_SERVICE_IMAGE_BYTES",
        "blob.download_as_bytes()",
    ):
        assert marker in source


def test_divider_renderer_embeds_service_image_before_text(monkeypatch):
    monkeypatch.setattr(pdf_divider_renderer, "_service_image_bytes", lambda content: PNG_1X1)
    doc = fitz.open()
    try:
        pdf_divider_renderer.render_divider_page(
            doc,
            '{"title":"간지","fg":"#ffffff","serviceImageId":"abc","serviceImagePath":"cover_templates/abc/service-x.png"}',
            "simple",
            210 * 72 / 25.4,
            297 * 72 / 25.4,
        )
        assert doc.page_count == 1
        assert doc[0].get_images(full=True)
    finally:
        doc.close()


def test_divider_service_image_falls_back_to_normal_background_when_unavailable(monkeypatch):
    monkeypatch.setattr(pdf_divider_renderer, "_service_image_bytes", lambda content: None)
    doc = fitz.open()
    try:
        pdf_divider_renderer.render_divider_page(
            doc,
            '{"title":"기본 간지","noBg":false,"bg":"#12396d","fg":"#ffffff"}',
            "simple",
            210 * 72 / 25.4,
            297 * 72 / 25.4,
        )
        assert doc.page_count == 1
    finally:
        doc.close()
