from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BRIDGE = (ROOT / "js/pdf-utility/security-large-file.js").read_text(encoding="utf-8")
API = (ROOT / "js/api.js").read_text(encoding="utf-8")
ROUTER = (ROOT / "backend/routers/pdf_large_security.py").read_text(encoding="utf-8")
STORAGE_RULES = (ROOT / "storage.rules").read_text(encoding="utf-8")
INJECTOR = (ROOT / "scripts/inject_boot_guard.py").read_text(encoding="utf-8")


def compact(value: str) -> str:
    return "".join(value.split())


def test_security_bridge_routes_only_large_encrypt_decrypt_to_storage():
    source = compact(BRIDGE)
    assert "DIRECT_MAX=20*1024*1024" in source
    assert "UTILITY_FILE_MAX=200*1024*1024" in source
    assert "SECURITY_MAX=500*1024*1024" in source
    assert "op==='encrypt'||op==='decrypt'" in source
    assert "size>DIRECT_MAX" in source
    assert "runStorageSecurity(op,file,params)" in source
    assert "returnoriginalApiPdfTool.apply(this,arguments)" in source


def test_security_bridge_uses_storage_backed_500mb_endpoint_and_cleanup():
    source = compact(BRIDGE)
    assert "SECURITY_ENDPOINT='/api/pdf-utility/security-storage'" in source
    assert "pdf_temp/${user.uid}/${session}/source.pdf" in BRIDGE
    assert "storage_path:storagePath" in source
    assert "operation:op" in source
    assert "_uploadStorageFile" in BRIDGE
    assert "_readPdfDelivery" in BRIDGE
    assert "awaitref.delete()" in source
    assert "30*60*1000" in source


def test_generic_pdf_tool_direct_limit_remains_unchanged():
    # Do not raise the generic multipart limit: only security operations get the Storage path.
    assert "20 * 1024 * 1024" in API
    assert "PDF 도구는 20MB 이하 파일만 지원합니다." in API


def test_security_ui_and_very_large_selection_allow_up_to_500mb():
    source = compact(BRIDGE)
    assert "window.syncFileActionAvailability=wrapped" in source
    assert "window.selectFile=wrapped" in source
    assert "window.runAutoDecrypt=wrapped" in source
    assert "window.addEventListener('change'" in BRIDGE
    assert "window.addEventListener('drop'" in BRIDGE
    assert "Number(file.size||0)>SECURITY_MAX" in source
    assert "최대 500MB" in BRIDGE
    assert "암호 설정·해제 전용" in BRIDGE


def test_backend_and_storage_rules_are_aligned_to_500mb():
    router = compact(ROUTER)
    rules = compact(STORAGE_RULES)
    assert "MAX_FILE_BYTES=500*1024*1024" in router
    assert '@pdf_large_security_bp.route("/security-storage",methods=["POST"])' in router
    assert 'operationnotin{"encrypt","decrypt"}' in router
    assert "request.resource.size<=524288000" in rules


def test_deployment_injects_bridge_into_pdf_utility_entry_pages():
    assert 'PDF_SECURITY_MARKER = "data-pdf-security-500mb"' in INJECTOR
    assert '"pdf-preflight/index.html"' in INJECTOR
    assert '"tools/preflight.html"' in INJECTOR
    assert '"tools/pdf-Checker.html"' in INJECTOR
    assert "/js/pdf-utility/security-large-file.js" in INJECTOR
