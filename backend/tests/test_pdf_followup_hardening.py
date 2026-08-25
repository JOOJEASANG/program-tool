import io
import json
from pathlib import Path

import fitz
from flask import Flask
from PIL import Image

from routers import pdf as pdf_router
from routers import pdf_tools as pdf_tools_router
from routers import preflight as preflight_router
from services import preflight_repair


def _app() -> Flask:
    app = Flask(__name__)
    app.config["TESTING"] = True
    return app


def _png_bytes(width: int = 2, height: int = 2) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buffer, format="PNG")
    return buffer.getvalue()


def test_image_to_pdf_corrupt_image_is_400_not_limit_413():
    app = _app()
    with app.test_request_context(
        "/api/pdf-tools/from-images",
        method="POST",
        data={
            "files": (io.BytesIO(b"not-an-image"), "broken.jpg"),
            "size": "fit",
        },
        content_type="multipart/form-data",
    ):
        response = pdf_tools_router.from_images.__wrapped__("user-1")

    assert response.status_code == 400
    assert response.get_json()["code"] == "IMAGE_INVALID"


def test_image_to_pdf_real_pixel_limit_remains_413(monkeypatch):
    monkeypatch.setattr(pdf_tools_router, "MAX_IMAGE_PIXELS_PER_FILE", 1)
    app = _app()
    with app.test_request_context(
        "/api/pdf-tools/from-images",
        method="POST",
        data={
            "files": (io.BytesIO(_png_bytes()), "small.png"),
            "size": "fit",
        },
        content_type="multipart/form-data",
    ):
        response = pdf_tools_router.from_images.__wrapped__("user-1")

    assert response.status_code == 413
    assert response.get_json()["code"] == "IMAGE_LIMIT_EXCEEDED"


def test_multi_pdf_direct_upload_reports_all_known_problem_files():
    app = _app()
    settings = json.dumps({"pages": [{"file_index": 0, "page_index": 0}]})
    with app.test_request_context(
        "/api/pdf/process",
        method="POST",
        data={
            "settings": settings,
            "files": [
                (io.BytesIO(b"broken-one"), "broken-one.pdf"),
                (io.BytesIO(b"broken-two"), "broken-two.pdf"),
                (io.BytesIO(b"text"), "notes.txt"),
            ],
        },
        content_type="multipart/form-data",
    ):
        response = pdf_router.process.__wrapped__("user-1")

    payload = response.get_json()
    assert response.status_code == 400
    assert payload["code"] == "PDF_INVALID_FILE_TYPE"
    assert "notes.txt" in payload["detail"]
    assert "broken-one.pdf" in payload["detail"]
    assert "broken-two.pdf" in payload["detail"]


def test_storage_preflight_uses_temp_paths_instead_of_blob_bytes():
    source = Path(preflight_router.__file__).read_text(encoding="utf-8")

    assert "blob.download_to_filename" in source
    assert "blob.download_as_bytes" not in source
    assert 'TemporaryDirectory(prefix="preflight-check-")' in source
    assert 'TemporaryDirectory(prefix="preflight-fix-")' in source
    assert 'TemporaryDirectory(prefix="preflight-compress-")' in source


def test_preflight_repair_opens_path_sources_without_reading_them_into_python_bytes(tmp_path):
    source_path = tmp_path / "source.pdf"
    document = fitz.open()
    document.new_page(width=100, height=120)
    document.save(str(source_path))
    document.close()

    opened = preflight_repair._open_source(source_path)
    try:
        assert opened.page_count == 1
        assert round(opened[0].rect.width) == 100
        assert round(opened[0].rect.height) == 120
    finally:
        opened.close()
