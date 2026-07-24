from pathlib import Path

import fitz

from models.schemas import PdfProcessRequest
from services import pdf_disk_ops, pdf_engine


def _source_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=300, height=500)
    page.insert_text((40, 60), "common-engine")
    data = doc.tobytes()
    doc.close()
    return data


def _request() -> PdfProcessRequest:
    return PdfProcessRequest.model_validate({
        "pages": [{"file_index": 0, "page_index": 0}],
    })


def test_memory_and_disk_wrappers_share_identical_page_geometry(tmp_path):
    source_bytes = _source_pdf_bytes()
    request = _request()

    memory_output = pdf_engine.process_pdf_bytes([source_bytes], request)
    source_path = tmp_path / "source.pdf"
    output_path = tmp_path / "output.pdf"
    source_path.write_bytes(source_bytes)
    pdf_engine.process_pdf_paths([source_path], request, output_path)

    memory_doc = fitz.open(stream=memory_output, filetype="pdf")
    disk_doc = fitz.open(str(output_path))
    try:
        assert memory_doc.page_count == disk_doc.page_count == 1
        assert memory_doc[0].rect == disk_doc[0].rect
        assert "common-engine" in memory_doc[0].get_text()
        assert "common-engine" in disk_doc[0].get_text()
    finally:
        memory_doc.close()
        disk_doc.close()


def test_disk_compatibility_service_delegates_to_common_engine(monkeypatch, tmp_path):
    captured = {}
    expected = tmp_path / "result.pdf"

    def fake_process(source_paths, request, output_path):
        captured["source_paths"] = source_paths
        captured["request"] = request
        captured["output_path"] = output_path
        return expected

    monkeypatch.setattr(pdf_disk_ops, "process_pdf_paths", fake_process)
    request = _request()
    result = pdf_disk_ops.process_pdf_files(
        [tmp_path / "source.pdf"], request, expected
    )

    assert result == expected
    assert captured["request"] is request
    assert captured["output_path"] == expected


def test_common_engine_preserves_blank_source_pages():
    source = fitz.open()
    source.new_page(width=200, height=200)
    source_bytes = source.tobytes()
    source.close()

    output = pdf_engine.process_pdf_bytes([source_bytes], _request())
    result = fitz.open(stream=output, filetype="pdf")
    try:
        assert result.page_count == 1
        assert result[0].rect.width > 0
        assert result[0].rect.height > 0
    finally:
        result.close()


def test_disk_service_contains_no_rendering_loop():
    service_path = Path(pdf_disk_ops.__file__)
    text = service_path.read_text(encoding="utf-8")
    assert "show_pdf_page" not in text
    assert "_apply_watermark" not in text
    assert "_apply_header_footer" not in text
    assert "process_pdf_paths(source_paths, request, output_path)" in text
