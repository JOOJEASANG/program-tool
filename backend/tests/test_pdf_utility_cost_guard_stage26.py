from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
MAIN=ROOT/"backend"/"main.py"; STORAGE_RULES=ROOT/"storage.rules"; DELIVERY=ROOT/"backend"/"utils"/"storage_delivery.py"; SECURITY=ROOT/"backend"/"routers"/"pdf_large_security.py"; FINALIZER=ROOT/"js"/"pdf-utility-finalize.js"; UTILITY_POLICY=ROOT/"js"/"pdf-utility-cost-guard-v2.js"; SECURITY_BRIDGE=ROOT/"js"/"pdf-utility"/"security-large-file.js"; PREFLIGHT_RUNTIME=ROOT/"js"/"pdf-preflight"/"route-runtime.js"; SW_REGISTER=ROOT/"js"/"sw-register.js"; INDEX=ROOT/"index.html"; GLOBAL_UI=ROOT/"js"/"program-studio-ui-v2.js"
def compact(v:str)->str:return "".join(v.split())
def test_pdf_storage_policy_is_200mb_per_file_and_300mb_per_job():
 main=MAIN.read_text(encoding="utf-8"); rules=STORAGE_RULES.read_text(encoding="utf-8"); policy=compact(UTILITY_POLICY.read_text(encoding="utf-8"))
 for marker in ("PDF_STORAGE_FILE_BYTES = 200 * MIB","PDF_STORAGE_TOTAL_BYTES = 300 * MIB","pdf_router.MAX_PDF_FILE_BYTES = PDF_STORAGE_FILE_BYTES","pdf_router.MAX_TOTAL_PDF_BYTES = PDF_STORAGE_TOTAL_BYTES","preflight_router.MAX_STORAGE_PDF_BYTES = PDF_STORAGE_FILE_BYTES","pdf_utility_router.MAX_FILE_BYTES = PDF_STORAGE_FILE_BYTES","pdf_utility_router.MAX_TOTAL_BYTES = PDF_STORAGE_TOTAL_BYTES"): assert marker in main
 assert "validPdfUpload(209715200)" in rules
 for marker in ("constMAX_FILES=10","constMAX_FILE_BYTES=200*1024*1024","constMAX_TOTAL_BYTES=300*1024*1024","nextTotal>MAX_TOTAL_BYTES","전체합계는최대300MB"): assert marker in policy
def test_high_cost_pdf_work_is_bounded_and_functions_do_not_scale_wildly():
 main=MAIN.read_text(encoding="utf-8")
 for marker in ("memory=options.MemoryOption.GB_2","min_instances=0","max_instances=2","pdf_utility_router.MAX_BACKGROUND_PAGES = 100","pdf_utility_router.MAX_BACKGROUND_PIXELS = 90_000_000","pdf_utility_router.BACKGROUND_DPI = 160",'schedule="every 1 hours"',"timedelta(hours=1)",'schedule="every 24 hours"',"MAX_SAVED_PDF_SESSIONS = 10","MAX_SAVED_DESIGN_PROJECTS = 8","ORPHAN_GRACE_HOURS = 24"): assert marker in main
def test_generated_pdf_delivery_is_300mb_bounded_and_one_hour_retention():
 source=DELIVERY.read_text(encoding="utf-8")
 for marker in ("RESULT_TTL_HOURS = 1","MAX_RESULT_BYTES = 300 * 1024 * 1024","size_bytes > MAX_RESULT_BYTES","최대 300MB",'"expiration_mode": "scheduled-delete"','"size_bytes": size_bytes'): assert marker in source
def test_large_encrypt_decrypt_uses_single_200mb_storage_bridge():
 backend=compact(SECURITY.read_text(encoding="utf-8")); bridge=compact(SECURITY_BRIDGE.read_text(encoding="utf-8")); runtime=PREFLIGHT_RUNTIME.read_text(encoding="utf-8")
 for marker in ("MAX_FILE_BYTES=200*1024*1024","MAX_PAGES=2000",'operationnotin{"encrypt","decrypt"}'): assert marker in backend
 assert "TemporaryDirectory" in SECURITY.read_text(encoding="utf-8") and "download_to_filename" in SECURITY.read_text(encoding="utf-8") and 'route("/security-storage"' in SECURITY.read_text(encoding="utf-8")
 assert "DIRECT_MAX=20*1024*1024" in bridge and "MAX_FILE_BYTES=200*1024*1024" in bridge and "SECURITY_MAX" not in bridge and "500MB" not in SECURITY_BRIDGE.read_text(encoding="utf-8")
 assert "/api/pdf-utility/security-storage" in SECURITY_BRIDGE.read_text(encoding="utf-8") and "/js/pdf-utility/security-large-file.js" in runtime
def test_home_uses_current_pdf_utility_label_without_legacy_sync_overlay():
 loader=SW_REGISTER.read_text(encoding="utf-8"); index=INDEX.read_text(encoding="utf-8"); ui=GLOBAL_UI.read_text(encoding="utf-8")
 assert "PDF 도구 모음" in index; assert "PDF 검사 · 유틸리티" in ui; assert "url:'/pdf-preflight/'" in ui; assert not (ROOT/"js"/"home-pdf-utility-name-sync.js").exists(); assert "homePdfUtilityNameSyncScriptV1" not in loader
def test_pdf_utility_runtime_has_one_policy_owner_and_functional_finalizer():
 finalizer=FINALIZER.read_text(encoding="utf-8"); runtime=PREFLIGHT_RUNTIME.read_text(encoding="utf-8"); policy=UTILITY_POLICY.read_text(encoding="utf-8")
 assert "/js/pdf-utility-cost-guard-v2.js" in runtime and "/js/pdf-utility-cost-policy-hardening.js" not in runtime and not (ROOT/"js"/"pdf-utility-cost-policy-hardening.js").exists(); assert "loadCostGuard" not in finalizer and "loadCostPolicyHardening" not in finalizer and "document.createElement('script')" not in finalizer; assert "200MB" in policy and "300MB" in policy and "pdfUtilityCostPolicy='200mb-file-300mb-job-v2'" in compact(policy)
def test_result_owner_can_delete_temp_output_immediately():
 rules=STORAGE_RULES.read_text(encoding="utf-8"); start=rules.index("match /pdf_results/{userId}/{resultId}/{fileName}"); end=rules.index("match /design_projects/{userId}/{projectId}/{fileName}"); block=rules[start:end]; assert "allow delete: if isOwner(userId);" in block and "allow create, update: if false;" in block
