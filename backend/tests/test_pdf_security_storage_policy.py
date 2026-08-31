from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BRIDGE = (ROOT / "js/pdf-utility/security-large-file.js").read_text(encoding="utf-8")
POLICY = (ROOT / "js/pdf-utility-cost-guard-v2.js").read_text(encoding="utf-8")
RUNTIME = (ROOT / "js/pdf-preflight/route-runtime.js").read_text(encoding="utf-8")
API = (ROOT / "js/api.js").read_text(encoding="utf-8")
ROUTER = (ROOT / "backend/routers/pdf_large_security.py").read_text(encoding="utf-8")
STORAGE_RULES = (ROOT / "storage.rules").read_text(encoding="utf-8")
INJECTOR = (ROOT / "scripts/inject_boot_guard.py").read_text(encoding="utf-8")


def compact(value: str) -> str:
    return "".join(value.split())


def test_security_bridge_routes_encrypt_decrypt_over_20mb_to_storage_with_200mb_ceiling():
    source = compact(BRIDGE)
    policy = compact(POLICY)
    assert "DIRECT_MAX=20*1024*1024" in source
    assert "MAX_FILE_BYTES=200*1024*1024" in source
    assert "operation==='encrypt'||operation==='decrypt'" in source
    assert "size>DIRECT_MAX" in source
    assert "runStorageSecurity(operation,file,params)" in source
    assert "returnoriginalApiPdfTool.apply(this,arguments)" in source
    assert "MAX_FILE_BYTES=200*1024*1024" in policy
    assert "MAX_TOTAL_BYTES=300*1024*1024" in policy
    assert "500MB" not in BRIDGE


def test_security_bridge_uses_storage_endpoint_and_cleanup():
    source = compact(BRIDGE)
    assert "SECURITY_ENDPOINT='/api/pdf-utility/security-storage'" in source
    assert "pdf_temp/${user.uid}/${session}/source.pdf" in BRIDGE
    assert "storage_path:storagePath" in source
    assert "operation," in BRIDGE
    assert "_uploadStorageFile" in BRIDGE
    assert "_readPdfDelivery" in BRIDGE
    assert "awaitref.delete()" in source
    assert "30*60*1000" in source


def test_generic_pdf_tool_direct_limit_remains_unchanged():
    assert "20 * 1024 * 1024" in API
    assert "PDF 도구는 20MB 이하 파일만 지원합니다." in API


def test_single_upload_policy_rejects_above_200mb_and_job_above_300mb():
    policy = compact(POLICY)
    assert "MAX_FILE_BYTES=200*1024*1024" in policy
    assert "MAX_TOTAL_BYTES=300*1024*1024" in policy
    assert "Number(file.size||0)>MAX_FILE_BYTES" in policy
    assert "nextTotal>MAX_TOTAL_BYTES" in policy
    assert "PDF한파일은최대200MB" in policy
    assert "전체합계는최대300MB" in policy


def test_backend_and_storage_rules_are_aligned_to_200mb():
    router = compact(ROUTER)
    rules = compact(STORAGE_RULES)
    assert "MAX_FILE_BYTES=200*1024*1024" in router
    assert '@pdf_large_security_bp.route("/security-storage",methods=["POST"])' in router
    assert 'operationnotin{"encrypt","decrypt"}' in router
    assert "validPdfUpload(209715200)" in rules


def test_deployment_does_not_inject_a_second_security_bridge_owner():
    assert "PDF_SECURITY_MARKER" not in INJECTOR
    assert "/js/pdf-utility/security-large-file.js" not in INJECTOR
    assert "/js/pdf-utility/security-large-file.js" in RUNTIME
    assert "pdfSecurityLargeFileScriptV1" in RUNTIME
