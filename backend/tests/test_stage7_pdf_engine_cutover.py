from pathlib import Path

from routers import pdf as pdf_router


def test_direct_upload_router_imports_common_memory_engine():
    source = Path(pdf_router.__file__).read_text(encoding="utf-8")

    assert "from services.pdf_engine import process_pdf_bytes" in source
    assert "output_bytes = process_pdf_bytes(file_bytes_list, req)" in source


def test_direct_upload_router_no_longer_calls_legacy_process_pdf():
    source = Path(pdf_router.__file__).read_text(encoding="utf-8")

    assert "import services.pdf_ops as pdf_ops" not in source
    assert "pdf_ops.process_pdf(" not in source


def test_direct_and_storage_routes_use_common_engine_entrypoints():
    source = Path(pdf_router.__file__).read_text(encoding="utf-8")

    assert "process_pdf_bytes(file_bytes_list, req)" in source
    assert "process_pdf_files(source_paths, req, output_path)" in source
