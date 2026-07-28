from pathlib import Path

import fitz

from models.schemas import PdfProcessRequest
from services.pdf_disk_ops import process_pdf_files
from routers import pdf as pdf_router


def _request_for_one_page() -> PdfProcessRequest:
    return PdfProcessRequest.model_validate({
        "paper": {"width_mm": 210, "height_mm": 297},
        "pages": [{"file_index": 0, "page_index": 0, "page_type": "normal"}],
        "nup_default": 1,
    })


def test_process_pdf_files_writes_valid_pdf(tmp_path):
    source_path = tmp_path / "source.pdf"
    output_path = tmp_path / "output.pdf"

    source = fitz.open()
    source.new_page(width=200, height=300)
    source.save(source_path)
    source.close()

    result = process_pdf_files([source_path], _request_for_one_page(), output_path)

    assert result == output_path
    assert output_path.exists()
    with fitz.open(output_path) as output:
        assert output.page_count == 1


def test_validate_pdf_paths_rejects_invalid_pdf(tmp_path):
    invalid_path = tmp_path / "invalid.pdf"
    invalid_path.write_bytes(b"not a pdf")

    try:
        pdf_router._validate_pdf_paths(_request_for_one_page(), [invalid_path])
    except ValueError as exc:
        assert str(exc) == "유효한 PDF 파일이 아닙니다"
    else:
        raise AssertionError("invalid PDF must be rejected")


def test_storage_route_uses_disk_processing_and_temporary_result_delivery():
    source = Path(pdf_router.__file__).read_text(encoding="utf-8")

    assert "download_to_filename" in source
    assert "download_as_bytes" not in source
    assert "process_pdf_files" in source
    assert "upload_pdf_result" in source
    assert "send_file" not in source


def test_local_temp_cleanup_removes_job_directory(tmp_path):
    job_dir = tmp_path / "pdf-job"
    job_dir.mkdir()
    (job_dir / "output.pdf").write_bytes(b"data")

    pdf_router._cleanup_local_directory(job_dir)

    assert not job_dir.exists()
