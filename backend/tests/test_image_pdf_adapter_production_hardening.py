from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADAPTER = (ROOT / "js" / "image-pdf-adapter.js").read_text(encoding="utf-8")
EDITOR_BRIDGE = (ROOT / "js" / "pdf-editor" / "image-input-bridge.js").read_text(encoding="utf-8")
SMART_BRIDGE = (ROOT / "js" / "smart-print-layout" / "image-input-bridge.js").read_text(encoding="utf-8")


def test_image_adapter_uses_bounded_decode_and_memory_friendly_jpeg_path():
    assert "const MAX_PIXELS=24*1000*1000;" in ADAPTER
    assert "const IMAGE_DECODE_TIMEOUT_MS=12000;" in ADAPTER
    assert "const JPEG_ENCODE_TIMEOUT_MS=12000;" in ADAPTER
    assert "bitmapAttempt" in ADAPTER
    assert "expired=true" in ADAPTER
    assert "bitmap?.close?.()" in ADAPTER
    assert "canvas.toBlob" in ADAPTER
    assert "new Uint8Array(await blob.arrayBuffer())" in ADAPTER
    assert "canvas.toDataURL" not in ADAPTER
    assert "if(file.size<=0)" in ADAPTER
    assert "if(!blob||blob.size<=0)" in ADAPTER
    assert "canvas.width=1;canvas.height=1" in ADAPTER


def test_pdf_editor_image_import_has_timeout_and_busy_recovery_contract():
    assert "const NORMALIZE_TIMEOUT_MS=30000;" in EDITOR_BRIDGE
    assert "const HANDLE_FILE_TIMEOUT_MS=45000;" in EDITOR_BRIDGE
    assert "document.documentElement.dataset.pdfImageImport='working'" in EDITOR_BRIDGE
    assert "document.documentElement.dataset.pdfImageImport=importedCount?'complete':'failed'" in EDITOR_BRIDGE
    assert "현재 파일을 불러오는 중입니다. 완료 후 다시 시도해 주세요." in EDITOR_BRIDGE
    assert "get busy(){return busy;}" in EDITOR_BRIDGE
    assert "pdf-editor-image-input-v3-production-hardening" in EDITOR_BRIDGE


def test_smart_print_image_import_intercepts_busy_raw_images_and_recovers_replay_state():
    assert "const NORMALIZE_TIMEOUT_MS=45000;" in SMART_BRIDGE
    assert "event.stopImmediatePropagation();" in SMART_BRIDGE
    assert "releaseReplayIfStuck" in SMART_BRIDGE
    assert "synthetic change was not observed; replay state recovered" in SMART_BRIDGE
    assert "document.documentElement.dataset.smartPrintImageImport='working'" in SMART_BRIDGE
    assert "document.documentElement.dataset.smartPrintImageImport='failed'" in SMART_BRIDGE
    assert "지원하지 않는 파일이 포함되어 있습니다" in SMART_BRIDGE
    assert "get busy(){return busy;}" in SMART_BRIDGE
    assert "smart-print-image-input-v3-production-hardening" in SMART_BRIDGE
