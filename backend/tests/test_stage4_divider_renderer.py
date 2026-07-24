import io
from pathlib import Path

import fitz

from models.schemas import PdfProcessRequest
from routers import pdf as pdf_router
from services import pdf_ops
from services.pdf_disk_ops import process_pdf_files


def _divider_request() -> PdfProcessRequest:
    return PdfProcessRequest.model_validate({
        "paper": {"width_mm": 210, "height_mm": 297},
        "pages": [{
            "file_index": 0,
            "page_index": 0,
            "page_type": "divider",
            "divider_style": "lines",
            "divider_content": (
                '{"title":"구분지 제목","subtitle":"부제",'
                '"note":"안내","titleY":35,"subtitleY":55,"noteY":85}'
            ),
        }],
        "nup_default": 1,
    })


def _blank_source_bytes() -> bytes:
    source = fitz.open()
    source.new_page(width=200, height=300)
    data = source.tobytes()
    source.close()
    return data


def test_router_has_no_runtime_divider_patch():
    source = Path(pdf_router.__file__).read_text(encoding="utf-8")
    assert "_patch_divider_renderer" not in source
    assert "_divider_renderer_patched" not in source
    assert "pdf_ops._render_divider_page =" not in source


def test_service_divider_renderer_creates_one_page():
    output = pdf_ops.process_pdf([_blank_source_bytes()], _divider_request())
    with fitz.open(stream=output, filetype="pdf") as document:
        assert document.page_count == 1
        assert document[0].rect.width > 0
        assert document[0].rect.height > 0


def test_direct_and_disk_paths_use_same_divider_renderer(tmp_path):
    source_path = tmp_path / "source.pdf"
    output_path = tmp_path / "output.pdf"
    source_path.write_bytes(_blank_source_bytes())
    memory_output = pdf_ops.process_pdf([source_path.read_bytes()], _divider_request())
    process_pdf_files([source_path], _divider_request(), output_path)
    with fitz.open(stream=memory_output, filetype="pdf") as memory_doc:
        with fitz.open(output_path) as disk_doc:
            assert memory_doc.page_count == disk_doc.page_count == 1
            assert memory_doc[0].rect == disk_doc[0].rect


def test_divider_renderer_does_not_require_router_initialization():
    output = io.BytesIO()
    document = fitz.open()
    pdf_ops._render_divider_page(
        document,
        '{"title":"Standalone","titleY":45}',
        "simple",
        595,
        842,
    )
    document.save(output)
    document.close()
    assert output.getvalue().startswith(b"%PDF")
