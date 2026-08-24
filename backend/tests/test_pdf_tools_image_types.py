from types import SimpleNamespace

from routers.pdf_tools import _image_filetype


def _upload(filename: str, mimetype: str):
    return SimpleNamespace(filename=filename, mimetype=mimetype)


def test_image_filetype_prefers_supported_browser_mime_over_misleading_extension():
    assert _image_filetype(_upload("scan.jpg", "image/png")) == "png"
    assert _image_filetype(_upload("photo.bin", "image/webp")) == "webp"


def test_image_filetype_normalizes_supported_filename_aliases_when_mime_is_generic():
    assert _image_filetype(_upload("scan.JPEG", "application/octet-stream")) == "jpg"
    assert _image_filetype(_upload("scan.tif", "application/octet-stream")) == "tiff"


def test_image_filetype_never_passes_arbitrary_extensions_to_pymupdf():
    assert _image_filetype(_upload("payload.exe", "application/octet-stream")) == "jpg"
    assert _image_filetype(_upload("no-extension", "")) == "jpg"
