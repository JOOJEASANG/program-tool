from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _block(text: str, marker: str, next_marker: str) -> str:
    start = text.index(marker)
    end = text.index(next_marker, start)
    return text[start:end]


def test_transient_pdf_storage_accepts_500mb_for_approved_owner():
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
        assert "isApproved()" in block
        assert "validPdfUpload(524288000)" in block
        assert "allow update: if false;" in block


def test_backend_utility_runtime_ceiling_stays_at_500mb():
    main = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
    assert "PDF_UTILITY_FILE_BYTES = 500 * MIB" in main
    assert "preflight_router.MAX_STORAGE_PDF_BYTES = PDF_UTILITY_FILE_BYTES" in main
    assert "pdf_utility_router.MAX_FILE_BYTES = PDF_UTILITY_FILE_BYTES" in main


def test_large_storage_client_refreshes_auth_before_upload_and_retries_permission_errors():
    large = (ROOT / "js" / "pdf-suite" / "direct-tool-large-storage.js").read_text(encoding="utf-8")

    assert "const MAX_FILE_BYTES=500*MIB" in large
    assert "STORAGE_AUTH_RETRY_CODES" in large
    assert "storage/unauthorized" in large
    assert "storage/unauthenticated" in large
    assert "await user.getIdToken(true)" in large
    assert "await refreshStorageAuth(user);" in large
    assert "uploadWithProgress(ref,file,root,user)" in large
    assert "preflight_temp" in large
    assert "pdf_temp" in large


def test_centered_workspace_keeps_500mb_selection_ceiling():
    centered = (ROOT / "js" / "pdf-suite" / "centered-workspace.js").read_text(encoding="utf-8")
    assert "const MAX_FILE_BYTES=500*MIB" in centered
    assert "PDF 한 파일은 최대 500MB까지 가능합니다." in centered
