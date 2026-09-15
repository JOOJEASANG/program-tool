from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MAIN = ROOT / "backend" / "main.py"


def test_pdf_editor_limits_stay_bounded_and_utility_gets_separate_capacity():
    source = MAIN.read_text(encoding="utf-8")
    assert "PDF_STORAGE_FILE_BYTES = 200 * MIB" in source
    assert "PDF_STORAGE_TOTAL_BYTES = 300 * MIB" in source
    assert "PDF_UTILITY_FILE_BYTES = 500 * MIB" in source
    assert "PDF_UTILITY_TOTAL_BYTES = 800 * MIB" in source
    assert "pdf_router.MAX_PDF_FILE_BYTES = PDF_STORAGE_FILE_BYTES" in source
    assert "pdf_router.MAX_TOTAL_PDF_BYTES = PDF_STORAGE_TOTAL_BYTES" in source
    assert "pdf_utility_router.MAX_FILE_BYTES = PDF_UTILITY_FILE_BYTES" in source
    assert "pdf_utility_router.MAX_TOTAL_BYTES = PDF_UTILITY_TOTAL_BYTES" in source
    assert "memory=options.MemoryOption.GB_4" in source
    assert "timeout_sec=600" in source
    assert "max_instances=2" in source