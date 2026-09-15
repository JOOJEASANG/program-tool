from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_large_pdf_save_bypasses_hosting_rewrite_timeout():
    api_js = (ROOT / "js" / "api.js").read_text(encoding="utf-8")

    assert "cloudfunctions.net/api" in api_js
    assert "_fetchLongPdfApi('/api/pdf/process-storage'" in api_js
    assert "fetch('/api/pdf/process-storage'" not in api_js
    assert "_fetchLongPdfApi('/api/pdf/process'" in api_js


def test_direct_pdf_function_allows_program_studio_origins_and_long_storage_jobs():
    main_py = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")

    assert "cors=options.CorsOptions(" in main_py
    assert "program-tool[.]web[.]app" in main_py
    assert "program-tool--[A-Za-z0-9-]+[.]web[.]app" in main_py
    assert 'cors_methods=["get", "post", "delete", "options"]' in main_py
    assert "timeout_sec=600" in main_py
    assert "flask_app.config[\"MAX_CONTENT_LENGTH\"] = 25 * MIB" in main_py


def test_hosting_csp_allows_direct_cloud_function_connection():
    firebase_json = (ROOT / "firebase.json").read_text(encoding="utf-8")

    assert "https://*.cloudfunctions.net" in firebase_json


def test_result_download_has_transient_network_retry_for_blob_consumers():
    api_js = (ROOT / "js" / "api.js").read_text(encoding="utf-8")

    assert "async function _fetchPdfResult" in api_js
    assert "attempts = 3" in api_js
    assert "완성 PDF 다운로드 연결에 실패했습니다." in api_js


def test_editor_direct_save_streams_storage_result_without_fetch_buffering():
    recovery_js = (
        ROOT / "js" / "pdf-editor" / "output-save-recovery.js"
    ).read_text(encoding="utf-8")

    assert "installStorageDirectBridge" in recovery_js
    assert "resp.clone().json()" in recovery_js
    assert "__pdfStorageBrowserDeliveryV1" in recovery_js
    assert "https://firebasestorage.googleapis.com/" in recovery_js
    assert "window._readPdfDelivery=bridgedRead" in recovery_js
    assert "mounted-storage-direct-v1" in recovery_js
    assert "browser-direct-v1" in recovery_js
    assert "directStorageUrls" in recovery_js