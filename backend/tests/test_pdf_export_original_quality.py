"""Verify actual output pixels and vector text survive both export transports."""
from pathlib import Path

import fitz
import pytest

from models.schemas import PdfProcessRequest
from services.pdf_engine import process_pdf_bytes, process_pdf_paths


@pytest.mark.parametrize("marks", [False, True])
def test_original_image_samples_and_vector_text_survive_repeated_exports(tmp_path, marks):
    # Nonuniform lossless RGB sample; checking pixels catches silent resampling.
    width, height = 480, 320
    samples = bytes((i * 17 + i // 137) % 256 for i in range(width * height * 3))
    image = fitz.Pixmap(fitz.csRGB, width, height, samples, False)
    with fitz.open() as source:
        page = source.new_page(width=300, height=420)
        page.insert_image(fitz.Rect(30, 50, 270, 210), pixmap=image)
        page.insert_text((30, 260), "VECTOR TEXT QUALITY", fontsize=16)
        page.draw_line((30, 280), (270, 280), color=(0.2, 0.4, 0.6))
        original = source.tobytes()
    request = PdfProcessRequest.model_validate({
        "pages": [{"file_index": 0, "page_index": 0}],
        "nup_default": 1,
        "print_marks": {"enabled": marks},
    })
    source_path = tmp_path / "original.pdf"
    source_path.write_bytes(original)
    result_path = tmp_path / "result.pdf"
    process_pdf_paths([source_path], request, result_path)
    for exported in (process_pdf_bytes([original], request), result_path.read_bytes()):
        with fitz.open(stream=exported, filetype="pdf") as doc:
            assert "VECTOR TEXT QUALITY" in doc[0].get_text()
            assert doc[0].get_drawings()
            images = doc[0].get_images(full=True)
            assert any(
                fitz.Pixmap(doc, entry[0]).samples == samples
                and entry[2:4] == (width, height)
                for entry in images
            ), "source image pixels must not be downsampled or lossily re-encoded"


def test_preview_quality_is_separate_from_final_pdf_export():
    root = Path(__file__).resolve().parents[2]
    editor = (root / "pdf-editor/index.html").read_text(encoding="utf-8")
    assert "async function renderWorkPreviewSource" in editor
    assert "withSharpPreviewPages" in editor
    assert "1800/Math.max" in editor
    assert "apiProcessPdf(uploadedFiles, outputSettings" in editor
    assert "canvas.width=1;canvas.height=1" in editor
