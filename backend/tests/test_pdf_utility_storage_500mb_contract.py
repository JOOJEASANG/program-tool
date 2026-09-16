from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _block(text: str, marker: str, next_marker: str) -> str:
    start = text.index(marker)
    end = text.index(next_marker, start)
    return text[start:end]


def test_transient_pdf_storage_accepts_500mb_for_signed_in_owner():
    rules = (ROOT / "storage.rules").read_text(encoding="utf-8")

    pdf_temp = _block(
        rules,
        "match /pdf_temp/{userId}/{sessionId}/{fileName}",
        "match /preflight_temp/{userId}/{sessionId}/{fileName}",
    )
    preflight_temp = _block(
        rules,
        "match /preflight_temp/{userId}/{sessionId}/{fileName}",
        "match /pdf_sessions/{userId}/{sessionId}/{fileName}",
    )

    for block in (pdf_temp, preflight_temp):
        assert "isOwner(userId)" in block
        assert "validPdfUpload(524288000)" in block
        assert "isApproved()" not in block


def test_backend_utility_runtime_ceiling_stays_at_500mb():
    main = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
    assert "PDF_UTILITY_FILE_BYTES = 500 * MIB" in main
    assert "preflight_router.MAX_STORAGE_PDF_BYTES = PDF_UTILITY_FILE_BYTES" in main
    assert "pdf_utility_router.MAX_FILE_BYTES = PDF_UTILITY_FILE_BYTES" in main


def test_centered_and_large_storage_clients_advertise_500mb():
    centered = (ROOT / "js" / "pdf-suite" / "centered-workspace.js").read_text(encoding="utf-8")
    large = (ROOT / "js" / "pdf-suite" / "direct-tool-large-storage.js").read_text(encoding="utf-8")

    assert "const MAX_FILE_BYTES=500*MIB" in centered
    assert "const MAX_FILE_BYTES=500*MIB" in large
    assert "preflight_temp" in large
    assert "pdf_temp" in large
