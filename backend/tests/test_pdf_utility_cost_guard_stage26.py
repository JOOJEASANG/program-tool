from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MAIN = ROOT / "backend" / "main.py"
STORAGE_RULES = ROOT / "storage.rules"
DELIVERY = ROOT / "backend" / "utils" / "storage_delivery.py"
SECURITY = ROOT / "backend" / "routers" / "pdf_large_security.py"
FINALIZER = ROOT / "js" / "pdf-utility-finalize.js"
LEGACY_COST_GUARD = ROOT / "js" / "pdf-utility-cost-guard-v2.js"
COST_POLICY = ROOT / "js" / "pdf-utility-cost-policy-hardening.js"
HOME_SYNC = ROOT / "js" / "home-pdf-utility-name-sync.js"
SW_REGISTER = ROOT / "js" / "sw-register.js"
INDEX = ROOT / "index.html"


def test_pdf_storage_policy_is_200mb_per_file_and_300mb_per_job():
    main = MAIN.read_text(encoding="utf-8")
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    policy = COST_POLICY.read_text(encoding="utf-8")

    assert "PDF_STORAGE_FILE_BYTES = 200 * MIB" in main
    assert "PDF_STORAGE_TOTAL_BYTES = 300 * MIB" in main
    assert "pdf_router.MAX_PDF_FILE_BYTES = PDF_STORAGE_FILE_BYTES" in main
    assert "pdf_router.MAX_TOTAL_PDF_BYTES = PDF_STORAGE_TOTAL_BYTES" in main
    assert "preflight_router.MAX_STORAGE_PDF_BYTES = PDF_STORAGE_FILE_BYTES" in main
    assert "pdf_utility_router.MAX_FILE_BYTES = PDF_STORAGE_FILE_BYTES" in main
    assert "pdf_utility_router.MAX_TOTAL_BYTES = PDF_STORAGE_TOTAL_BYTES" in main
    assert "validPdfUpload(209715200)" in rules
    assert "const MAX_FILES=10" in policy
    assert "const MAX_FILE_BYTES=200*1024*1024" in policy
    assert "const MAX_TOTAL_BYTES=300*1024*1024" in policy
    assert "nextTotal>MAX_TOTAL_BYTES" in policy
    assert "전체 합계는 최대 300MB" in policy


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


def test_large_encrypt_decrypt_uses_storage_and_temp_files_with_200mb_ceiling():
    source = SECURITY.read_text(encoding="utf-8")
    main = MAIN.read_text(encoding="utf-8")
    legacy_guard = LEGACY_COST_GUARD.read_text(encoding="utf-8")
    policy = COST_POLICY.read_text(encoding="utf-8")

    assert "MAX_FILE_BYTES = 200 * 1024 * 1024" in source
    assert "MAX_PAGES = 2000" in source
    assert "TemporaryDirectory" in source
    assert "download_to_filename" in source
    assert 'operation not in {"encrypt", "decrypt"}' in source
    assert 'route("/security-storage"' in source
    assert "pdf_large_security_bp" in main
    assert 'url_prefix="/api/pdf-utility"' in main
    # The historical 500MB helper still owns the security modal, while the
    # capture-phase policy guard prevents >200MB files from reaching it.
    assert "/api/pdf-utility/security-storage" in legacy_guard
    assert "DIRECT_SECURITY_BYTES = 20 * 1024 * 1024" in legacy_guard
    assert "MAX_FILE_BYTES=200*1024*1024" in policy


def test_home_fallback_is_current_while_managed_catalog_old_names_remain_normalized():
    sync = HOME_SYNC.read_text(encoding="utf-8")
    loader = SW_REGISTER.read_text(encoding="utf-8")
    index = INDEX.read_text(encoding="utf-8")

    assert "인쇄 전 검사" in index
    assert "url:'pdf-preflight/'" in index
    assert "PDF 인쇄 검수" not in index
    for alias in ("PDF 인쇄 검수", "PDF 검사", "PDF 인쇄 검수기", "PDF 검사기"):
        assert alias in sync
    assert "program.name = 'PDF유틸리티'" in sync
    assert "pdf-preflight" in sync
    assert "program-catalog-applied" in sync
    assert "homePdfUtilityNameSyncScriptV1" in loader


def test_pdf_utility_finalizer_layers_strict_cost_policy_after_legacy_guard():
    finalizer = FINALIZER.read_text(encoding="utf-8")
    loader = SW_REGISTER.read_text(encoding="utf-8")
    legacy_guard = LEGACY_COST_GUARD.read_text(encoding="utf-8")
    policy = COST_POLICY.read_text(encoding="utf-8")

    assert "파일당 200MB · 전체 합계 300MB" in finalizer
    assert "loadCostGuard()" in finalizer
    assert "/js/pdf-utility-cost-guard-v2.js?v=20260818-1" in finalizer
    assert "/js/pdf-utility-cost-policy-hardening.js?v=20260831-1" in finalizer
    assert "/js/pdf-utility-finalize.js?v=20260818-3" in loader
    assert "cloneNode(true)" in legacy_guard
    assert "document.addEventListener('change',onChange,true)" in policy
    assert "document.addEventListener('drop',onDrop,true)" in policy
    assert "pdfUtilityCostPolicy='200mb-file-300mb-job-v1'" in policy


def test_result_owner_can_delete_temp_output_immediately():
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    start = rules.index("match /pdf_results/{userId}/{resultId}/{fileName}")
    end = rules.index("match /design_projects/{userId}/{projectId}/{fileName}")
    block = rules[start:end]

    assert "allow delete: if isOwner(userId);" in block
    assert "allow create, update: if false;" in block
