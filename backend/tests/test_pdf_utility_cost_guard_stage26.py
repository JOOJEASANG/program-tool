from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MAIN = ROOT / "backend" / "main.py"
STORAGE_RULES = ROOT / "storage.rules"
DELIVERY = ROOT / "backend" / "utils" / "storage_delivery.py"
SECURITY = ROOT / "backend" / "routers" / "pdf_large_security.py"
FINALIZER = ROOT / "js" / "pdf-utility-finalize.js"
UTILITY_POLICY = ROOT / "js" / "pdf-utility-cost-guard-v2.js"
SECURITY_BRIDGE = ROOT / "js" / "pdf-utility" / "security-large-file.js"
PREFLIGHT_RUNTIME = ROOT / "js" / "pdf-preflight" / "route-runtime.js"
SW_REGISTER = ROOT / "js" / "sw-register.js"
INDEX = ROOT / "index.html"
GLOBAL_UI = ROOT / "js" / "program-studio-ui-v2.js"


def compact(value: str) -> str:
    return "".join(value.split())


def test_pdf_storage_policy_is_200mb_per_file_and_300mb_per_job():
    main = MAIN.read_text(encoding="utf-8")
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    policy = compact(UTILITY_POLICY.read_text(encoding="utf-8"))
    assert "PDF_STORAGE_FILE_BYTES = 200 * MIB" in main
    assert "PDF_STORAGE_TOTAL_BYTES = 300 * MIB" in main
    assert "pdf_router.MAX_PDF_FILE_BYTES = PDF_STORAGE_FILE_BYTES" in main
    assert "pdf_router.MAX_TOTAL_PDF_BYTES = PDF_STORAGE_TOTAL_BYTES" in main
    assert "preflight_router.MAX_STORAGE_PDF_BYTES = PDF_STORAGE_FILE_BYTES" in main
    assert "pdf_utility_router.MAX_FILE_BYTES = PDF_STORAGE_FILE_BYTES" in main
    assert "pdf_utility_router.MAX_TOTAL_BYTES = PDF_STORAGE_TOTAL_BYTES" in main
    assert "validPdfUpload(209715200)" in rules
    assert "constMAX_FILES=10" in policy
    assert "constMAX_FILE_BYTES=200*1024*1024" in policy
    assert "constMAX_TOTAL_BYTES=300*1024*1024" in policy
    assert "nextTotal>MAX_TOTAL_BYTES" in policy
    assert "전체합계는최대300MB" in policy


def test_high_cost_pdf_work_is_bounded_and_functions_do_not_scale_wildly():
    main = MAIN.read_text(encoding="utf-8")
    assert "memory=options.MemoryOption.GB_2" in main
    assert "min_instances=0" in main
    assert "max_instances=2" in main
    assert "pdf_utility_router.MAX_BACKGROUND_PAGES = 100" in main
    assert "pdf_utility_router.MAX_BACKGROUND_PIXELS = 90_000_000" in main
    assert "pdf_utility_router.BACKGROUND_DPI = 160" in main
    assert 'schedule="every 1 hours"' in main
    assert "timedelta(hours=1)" in main
    assert 'schedule="every 24 hours"' in main
    assert "MAX_SAVED_PDF_SESSIONS = 10" in main
    assert "MAX_SAVED_DESIGN_PROJECTS = 8" in main
    assert "ORPHAN_GRACE_HOURS = 24" in main


def test_generated_pdf_delivery_is_300mb_bounded_and_one_hour_retention():
    source = DELIVERY.read_text(encoding="utf-8")
    assert "RESULT_TTL_HOURS = 1" in source
    assert "MAX_RESULT_BYTES = 300 * 1024 * 1024" in source
    assert "size_bytes > MAX_RESULT_BYTES" in source
    assert "최대 300MB" in source
    assert '"expiration_mode": "scheduled-delete"' in source
    assert '"size_bytes": size_bytes' in source


def test_large_encrypt_decrypt_uses_single_200mb_storage_bridge():
    backend = compact(SECURITY.read_text(encoding="utf-8"))
    bridge = compact(SECURITY_BRIDGE.read_text(encoding="utf-8"))
    runtime = PREFLIGHT_RUNTIME.read_text(encoding="utf-8")
    assert "MAX_FILE_BYTES=200*1024*1024" in backend
    assert "MAX_PAGES=2000" in backend
    assert "TemporaryDirectory" in SECURITY.read_text(encoding="utf-8")
    assert "download_to_filename" in SECURITY.read_text(encoding="utf-8")
    assert 'operationnotin{"encrypt","decrypt"}' in backend
    assert 'route("/security-storage"' in SECURITY.read_text(encoding="utf-8")
    assert "DIRECT_MAX=20*1024*1024" in bridge
    assert "MAX_FILE_BYTES=200*1024*1024" in bridge
    assert "SECURITY_MAX" not in bridge
    assert "500MB" not in SECURITY_BRIDGE.read_text(encoding="utf-8")
    assert "/api/pdf-utility/security-storage" in SECURITY_BRIDGE.read_text(encoding="utf-8")
    assert "/js/pdf-utility/security-large-file.js" in runtime


def test_home_uses_current_pdf_utility_label_without_legacy_sync_overlay():
    loader = SW_REGISTER.read_text(encoding="utf-8")
    index = INDEX.read_text(encoding="utf-8")
    ui = GLOBAL_UI.read_text(encoding="utf-8")
    assert "PDF 도구 모음" in index
    assert "PDF 검사 · 유틸리티" in ui
    assert "url:'/pdf-preflight/'" in ui
    assert not (ROOT / "js" / "home-pdf-utility-name-sync.js").exists()
    assert "homePdfUtilityNameSyncScriptV1" not in loader


def test_pdf_utility_runtime_has_one_policy_owner_and_functional_finalizer():
    finalizer = FINALIZER.read_text(encoding="utf-8")
    runtime = PREFLIGHT_RUNTIME.read_text(encoding="utf-8")
    policy = UTILITY_POLICY.read_text(encoding="utf-8")
    assert "/js/pdf-utility-cost-guard-v2.js" in runtime
    assert "/js/pdf-utility-cost-policy-hardening.js" not in runtime
    assert not (ROOT / "js" / "pdf-utility-cost-policy-hardening.js").exists()
    assert "loadCostGuard" not in finalizer
    assert "loadCostPolicyHardening" not in finalizer
    assert "document.createElement('script')" not in finalizer
    assert "200MB" in policy
    assert "300MB" in policy
    assert "pdfUtilityCostPolicy='200mb-file-300mb-job-v2'" in compact(policy)


def test_result_owner_can_delete_temp_output_immediately():
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    start = rules.index("match /pdf_results/{userId}/{resultId}/{fileName}")
    end = rules.index("match /design_projects/{userId}/{projectId}/{fileName}")
    block = rules[start:end]
    assert "allow delete: if isOwner(userId);" in block
    assert "allow create, update: if false;" in block
