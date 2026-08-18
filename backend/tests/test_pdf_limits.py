from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MAIN = ROOT / "backend" / "main.py"


def test_pdf_total_limit_is_bounded_below_function_memory():
    source = MAIN.read_text(encoding="utf-8")
    assert "PDF_STORAGE_TRANSFER_BYTES = 500 * 1024 * 1024" in source
    assert "pdf_router.MAX_PDF_FILE_BYTES = PDF_STORAGE_TRANSFER_BYTES" in source
    assert "pdf_router.MAX_TOTAL_PDF_BYTES = PDF_STORAGE_TRANSFER_BYTES" in source
    assert "memory=options.MemoryOption.GB_2" in source
