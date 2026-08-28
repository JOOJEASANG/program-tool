from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MAIN = ROOT / "backend" / "main.py"
STORAGE_RULES = ROOT / "storage.rules"
DELIVERY = ROOT / "backend" / "utils" / "storage_delivery.py"
SECURITY = ROOT / "backend" / "routers" / "pdf_large_security.py"
FINALIZER = ROOT / "js" / "pdf-utility-finalize.js"
COST_GUARD = ROOT / "js" / "pdf-utility-cost-guard-v2.js"
HOME_SYNC = ROOT / "js" / "home-pdf-utility-name-sync.js"
SW_REGISTER = ROOT / "js" / "sw-register.js"
INDEX = ROOT / "index.html"


def test_pdf_storage_policy_allows_500mb_but_not_unbounded_batch_growth():
    main = MAIN.read_text(encoding="utf-8")
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    guard = COST_GUARD.read_text(encoding="utf-8")

    assert "PDF_STORAGE_TRANSFER_BYTES = 500 * 1024 * 1024" in main
    assert "pdf_router.MAX_PDF_FILE_BYTES = PDF_STORAGE_TRANSFER_BYTES" in main
    assert "pdf_router.MAX_TOTAL_PDF_BYTES = PDF_STORAGE_TRANSFER_BYTES" in main
    assert "preflight_router.MAX_STORAGE_PDF_BYTES = PDF_STORAGE_TRANSFER_BYTES" in main
    assert "pdf_utility_router.MAX_FILE_BYTES = PDF_STORAGE_TRANSFER_BYTES" in main
    assert "pdf_utility_router.MAX_TOTAL_BYTES = PDF_STORAGE_TRANSFER_BYTES" in main
    assert "request.resource.size <= 524288000" in rules
    assert "const MAX_FILES = 10" in guard
    assert "const MAX_BYTES = 500 * 1024 * 1024" in guard
    assert "nextTotal > MAX_BYTES" in guard
    assert "전체 합계는 최대 500MB" in guard


def test_high_cost_pdf_work_is_bounded_and_functions_do_not_scale_wildly():
    main = MAIN.read_text(encoding="utf-8")

    assert "memory=options.MemoryOption.GB_2" in main
    assert "min_instances=0" in main
    assert "max_instances=2" in main
    assert "pdf_utility_router.MAX_BACKGROUND_PAGES = 100" in main
    assert "pdf_utility_router.MAX_BACKGROUND_PIXELS = 90_000_000" in main
    assert "pdf_utility_router.BACKGROUND_DPI = 160" in main
    assert 'schedule="every 6 hours"' in main
    assert "timedelta(hours=6)" in main


def test_generated_pdf_delivery_is_500mb_bounded_and_short_lived():
    source = DELIVERY.read_text(encoding="utf-8")

    assert "RESULT_TTL_HOURS = 6" in source
    assert "MAX_RESULT_BYTES = 500 * 1024 * 1024" in source
    assert "size_bytes > MAX_RESULT_BYTES" in source
    assert "최대 500MB" in source
    assert '"size_bytes": size_bytes' in source


def test_large_encrypt_decrypt_uses_storage_and_temp_files():
    source = SECURITY.read_text(encoding="utf-8")
    main = MAIN.read_text(encoding="utf-8")
    guard = COST_GUARD.read_text(encoding="utf-8")

    assert "MAX_FILE_BYTES = 500 * 1024 * 1024" in source
    assert "MAX_PAGES = 2000" in source
    assert "TemporaryDirectory" in source
    assert "download_to_filename" in source
    assert 'operation not in {"encrypt", "decrypt"}' in source
    assert 'route("/security-storage"' in source
    assert "pdf_large_security_bp" in main
    assert 'url_prefix="/api/pdf-utility"' in main
    assert "/api/pdf-utility/security-storage" in guard
    assert "DIRECT_SECURITY_BYTES = 20 * 1024 * 1024" in guard


def test_home_fallback_is_current_while_managed_catalog_old_names_remain_normalized():
    sync = HOME_SYNC.read_text(encoding="utf-8")
    loader = SW_REGISTER.read_text(encoding="utf-8")
    index = INDEX.read_text(encoding="utf-8")

    # The initial home is already print-first; the synchronizer only keeps old
    # managed-catalog aliases compatible for users with historical settings.
    assert "인쇄 전 검사" in index
    assert "url:'pdf-preflight/'" in index
    assert "PDF 인쇄 검수" not in index
    for alias in ("PDF 인쇄 검수", "PDF 검사", "PDF 인쇄 검수기", "PDF 검사기"):
        assert alias in sync
    assert "program.name = 'PDF유틸리티'" in sync
    assert "pdf-preflight" in sync
    assert "program-catalog-applied" in sync
    assert "homePdfUtilityNameSyncScriptV1" in loader


def test_pdf_utility_finalizer_loads_stable_500mb_guard():
    finalizer = FINALIZER.read_text(encoding="utf-8")
    loader = SW_REGISTER.read_text(encoding="utf-8")
    guard = COST_GUARD.read_text(encoding="utf-8")

    assert "파일당/전체 합계 500MB" in finalizer
    assert "loadCostGuard()" in finalizer
    assert "/js/pdf-utility-cost-guard-v2.js?v=20260818-1" in finalizer
    assert "/js/pdf-utility-finalize.js?v=20260818-3" in loader
    assert "setTextIfChanged" in guard
    assert "setHtmlIfChanged" in guard
    assert "cloneNode(true)" in guard
    assert "pdfUtilityCostGuard = '2'" in guard


def test_result_owner_can_delete_temp_output_immediately():
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    start = rules.index("match /pdf_results/{userId}/{resultId}/{fileName}")
    end = rules.index("match /cover_templates/{templateId}/{fileName}")
    block = rules[start:end]

    assert "allow delete: if isOwner(userId);" in block
    assert "allow create, update: if false;" in block
