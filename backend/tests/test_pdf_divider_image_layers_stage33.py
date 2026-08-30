import base64
import io
import json
import struct
import zlib
from pathlib import Path

import fitz

from services import pdf_divider_renderer


ROOT = Path(__file__).resolve().parents[2]


def _png_data_url(rgb: tuple[int, int, int], width: int = 12, height: int = 8) -> str:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)

    row = bytes([0]) + bytes(rgb) * width
    raw = row * height
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")


def test_divider_layer_ui_defaults_to_no_background_and_supports_stacking():
    source = (ROOT / "js/pdf-divider-local-image-upload.js").read_text(encoding="utf-8")

    assert 'type="file" multiple' in source
    assert "localImageLayers" in source
    assert "MAX_LAYERS = 6" in source
    assert "MAX_TOTAL_EMBED_BYTES = 15 * 1024 * 1024" in source
    assert "pdfDividerLayerScale" in source
    assert "pdfDividerLayerX" in source
    assert "pdfDividerLayerY" in source
    assert "pdfDividerLayerBack" in source
    assert "pdfDividerLayerFront" in source
    assert "pdfDividerLayerDelete" in source
    assert "function setNewDividerDefaults()" in source
    assert "bg.value = '#ffffff'" in source
    assert "noBg.checked = true" in source
    assert "fg.value = '#1f2937'" in source


def test_route_keeps_single_pdf_program_and_loads_new_divider_layer_revision():
    route = (ROOT / "js/pdf-editor/route-runtime.js").read_text(encoding="utf-8")
    assert route.count("{id:") == 18
    assert "/js/pdf-divider-local-image-upload.js?v=20260830-1" in route


def test_backend_clamps_and_preserves_divider_layer_order():
    first = _png_data_url((255, 0, 0))
    second = _png_data_url((0, 0, 255))
    layers = pdf_divider_renderer._local_image_layers({
        "localImageLayers": [
            {"dataUrl": first, "x": -20, "y": 120, "scale": 2, "fit": "contain"},
            {"dataUrl": second, "x": 75, "y": 25, "scale": 500, "fit": "cover"},
        ]
    })

    assert len(layers) == 2
    assert layers[0]["x"] == 0
    assert layers[0]["y"] == 100
    assert layers[0]["scale"] == 10
    assert layers[0]["fit"] == "contain"
    assert layers[1]["x"] == 75
    assert layers[1]["y"] == 25
    assert layers[1]["scale"] == 300
    assert layers[1]["fit"] == "cover"


def test_backend_renders_multiple_divider_image_layers_into_final_pdf():
    content = {
        "title": "레이어 간지",
        "noBg": True,
        "fg": "#111827",
        "localImageLayers": [
            {"dataUrl": _png_data_url((255, 0, 0)), "x": 30, "y": 35, "scale": 45, "fit": "contain"},
            {"dataUrl": _png_data_url((0, 0, 255)), "x": 70, "y": 65, "scale": 35, "fit": "contain"},
        ],
    }
    document = fitz.open()
    pdf_divider_renderer.render_divider_page(
        document,
        json.dumps(content),
        "simple",
        595.28,
        841.89,
    )
    output = io.BytesIO()
    document.save(output)
    document.close()

    reopened = fitz.open(stream=output.getvalue(), filetype="pdf")
    try:
        page = reopened[0]
        assert "레이어 간지" in page.get_text()
        assert len(page.get_images(full=True)) >= 2
    finally:
        reopened.close()


def test_legacy_single_image_decoder_remains_supported():
    raw = pdf_divider_renderer._local_image_bytes({"localImageDataUrl": _png_data_url((10, 20, 30))})
    assert isinstance(raw, bytes)
    assert raw.startswith(b"\x89PNG")
