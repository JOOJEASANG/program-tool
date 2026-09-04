from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_preflight_runtime_loads_local_processing_after_pdf_utility():
    runtime = read("js/pdf-preflight/route-runtime.js")
    utility_pos = runtime.index("pdfUtilityScriptV1")
    local_pos = runtime.index("pdfUtilityLocalProcessingScriptV1")
    assert utility_pos < local_pos
    assert "/js/pdf-utility/local-processing.js?v=20260904-1" in runtime
    assert "canonical-preflight-runtime-v2" in runtime


def test_local_merge_contract_is_browser_first_with_server_fallback():
    local = read("js/pdf-utility/local-processing.js")
    assert "local-first-with-server-fallback" in local
    assert "120*1024*1024" in local
    assert "PDFDocument.create" in local
    assert "PDFDocument.load" in local
    assert "copyPages" in local
    assert "file.arrayBuffer()" in local
    assert "server-fallback" in local
    assert "bypassOnce" in local
    assert "button.click()" in local
    assert "서버 업로드 없음" in local


def test_local_merge_does_not_duplicate_server_upload_endpoint():
    local = read("js/pdf-utility/local-processing.js")
    assert "/api/pdf-utility/merge-storage" not in local
    assert "firebase.storage" not in local
    assert "storageInstance.ref" not in local


def test_local_processing_tracks_actual_ui_order_and_file_changes():
    local = read("js/pdf-utility/local-processing.js")
    assert "#pdfUtilityFileItems .pdfu-file-row" in local
    assert "resolveOrderedFiles" in local
    assert "document.addEventListener('change',onDocumentChange,true)" in local
    assert "document.addEventListener('drop',onDocumentDrop,true)" in local
    assert "document.addEventListener('click',onDocumentClick,true)" in local
