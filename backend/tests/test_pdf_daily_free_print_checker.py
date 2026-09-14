from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
QUOTA = ROOT / "js" / "pdf-daily-free.js"
CATALOG = ROOT / "js" / "program-usage-catalog.js"
OUTPUT_GUARD = ROOT / "js" / "program-usage-output-guard.js"
ACCESS = ROOT / "js" / "print-checker" / "access.js"
DEFAULTS = ROOT / "js" / "print-checker" / "defaults-live.js"
ADMIN_LIMITS = ROOT / "js" / "admin-program-usage-settings.js"
ADMIN_COMPAT = ROOT / "js" / "admin-pdf-usage-settings.js"
PRINT_HTML = ROOT / "print-checker" / "index.html"
SMART_HTML = ROOT / "smart-print-layout" / "index.html"
PDF_ROUTE = ROOT / "js" / "pdf-editor" / "route-runtime.js"
ADVANCED_BOOT = ROOT / "js" / "pdf-editor-advanced" / "firebase-bootstrap.js"
HOSTING = ROOT / "scripts" / "prepare_hosting_dist.py"
RULES = ROOT / "firestore.rules"
RUNNER = ROOT / "scripts" / "run_phase5_browser_smoke.sh"


def test_program_usage_catalog_is_extensible_and_covers_current_programs():
    source = CATALOG.read_text(encoding="utf-8")

    for marker in (
        "function register(entry)",
        "function resolve(pathname=location.pathname)",
        "outputActionSelector",
        "stage:'program-usage-catalog-v2-output-actions'",
        "'print-checker'",
        "'smart-print-layout'",
        "'pdf-editor'",
        "'pdf-editor-advanced'",
        "'pdf-preflight'",
    ):
        assert marker in source

    assert source.count("outputActionSelector:'#downloadBtn'") == 3


def test_usage_policy_is_program_specific_and_keeps_legacy_pdf_api():
    source = QUOTA.read_text(encoding="utf-8")

    for marker in (
        "const SETTINGS_COLLECTION='program_usage_limits'",
        "const LEGACY_LIMITS_DOCUMENT='pdf_daily_limits'",
        "programStudioUsage:guest:",
        "programStudioUsage:member:",
        "collection('program_usage')",
        "memberUsageDocId",
        "localMonthKey",
        "period==='monthly'",
        "guestLimit",
        "memberLimit",
        "window.ProgramUsagePolicy=genericApi",
        "window.ProgramPdfDailyFree=Object.freeze",
        "forProgram",
        "program-usage-commit",
        "stage:'program-usage-policy-v3-per-program'",
        "stage:'pdf-daily-free-v3-per-program-compatibility'",
    ):
        assert marker in source

    assert "const LIMIT_MIN=-1" in source
    assert "const LIMIT_MAX=1000" in source
    assert "enabled:data.enabled!==false" in source
    assert "raw<0?Infinity:raw" in source
    assert "limit===0" in source


def test_admin_usage_is_unlimited_before_settings_or_counter_reads():
    source = QUOTA.read_text(encoding="utf-8")

    read_status = source.index("async function readStatus")
    admin_guard = source.index("if(user&&await isAdmin(user))return makeStatus('admin'", read_status)
    settings_read = source.index("const settings=await loadLimits", read_status)
    assert admin_guard < settings_read
    assert "관리자 · 사용 제한 없음" in source


def test_suite_quota_only_guards_real_processing_actions():
    source = QUOTA.read_text(encoding="utf-8")

    selector_line = next(line for line in source.splitlines() if "const SUITE_ACTION_SELECTOR=" in line)
    for marker in (
        "[data-local-run]",
        "[data-ocr-run]",
        "[data-compare-run]",
        "[data-redact-export]",
        "[data-attach-open]",
        "[data-access-run]",
        "[data-outline-run]",
        '[data-advanced-action="text"]',
    ):
        assert marker in selector_line

    for excluded in ("[data-compare-download]", ".pdfadv-mini", ".pdfadv-tool-ready", ".pdfocr-ready"):
        assert excluded not in selector_line
    assert "programId:'pdf-preflight'" in source


def test_result_generation_guard_is_lazy_reusable_and_commits_only_after_download():
    source = OUTPUT_GUARD.read_text(encoding="utf-8")

    for marker in (
        "[data-program-usage-action]",
        "outputActionSelector",
        "ensureDependencies",
        "policy.forProgram(programId)",
        "api.canStart(action)",
        "node.dataset.programUsagePass='1'",
        "a[download]",
        "commitPending",
        "commitSuccess(item.action)",
        "program-usage-output-committed",
        "stage:'program-usage-output-guard-v1-lazy'",
    ):
        assert marker in source

    assert source.index("api.canStart(action)") < source.index("node.click()")
    assert source.index("a[download]") < source.index("commitPending();")


def test_current_result_programs_load_the_shared_output_guard():
    smart = SMART_HTML.read_text(encoding="utf-8")
    route = PDF_ROUTE.read_text(encoding="utf-8")
    advanced = ADVANCED_BOOT.read_text(encoding="utf-8")

    assert 'data-program-usage-program="smart-print-layout"' in smart
    assert '/js/program-usage-output-guard.js?v=20260914-1' in smart
    assert "programUsageOutputGuardScriptV1" in route
    assert "/js/program-usage-output-guard.js?v=20260914-1" in route
    assert "if(!advanced)pending.push" in route
    assert "loadUsageOutputGuard" in advanced
    assert "/js/program-usage-output-guard.js?v=20260914-1" in advanced


def test_admin_can_edit_usage_limits_per_program_and_add_future_programs():
    source = ADMIN_LIMITS.read_text(encoding="utf-8")
    compat = ADMIN_COMPAT.read_text(encoding="utf-8")

    for marker in (
        "프로그램별 사용횟수",
        "비회원",
        "회원",
        "초기화 주기",
        "무제한",
        "사용 불가",
        "const COLLECTION='program_usage_limits'",
        "saveProgram",
        "saveAll",
        "addCustomProgram",
        "newUsageProgramId",
        "ProgramUsageCatalog?.list",
        "serverTimestamp",
        "관리자 계정은 항상 제한 없이 사용합니다.",
        "stage:'admin-program-usage-settings-v2-extensible'",
    ):
        assert marker in source

    assert "/js/program-usage-catalog.js?v=20260914-1" in compat
    assert "/js/admin-program-usage-settings.js?v=20260914-1" in compat
    assert "admin-pdf-usage-compatibility-bootstrap-v2" in compat


def test_print_checker_keeps_public_usage_policy_and_runtime_limit_display():
    access = ACCESS.read_text(encoding="utf-8")
    html = PRINT_HTML.read_text(encoding="utf-8")

    assert "guardTool" not in access
    assert "approval-waiting" not in access
    assert "daily-free" in access
    assert "quota.status()" in access
    assert "status.limit" in access
    assert "/js/pdf-daily-free.js" in html
    assert html.index("pdf-daily-free.js") < html.index("defaults-live.js")


def test_print_checker_defaults_cover_all_inputs_and_live_size_modes():
    source = DEFAULTS.read_text(encoding="utf-8")

    for marker in (
        "A3 · 297 × 420 mm",
        "A4 · 210 × 297 mm",
        "A5 · 148 × 210 mm",
        "B5 · 182 × 257 mm",
        "명함 · 90 × 50 mm",
        "직접 입력",
        "const DEFAULT_WING_MM=90",
        "flyer:{size:'a4',trimW:210,trimH:297,bleed:3,safeZone:10}",
        "invitation:{size:'a5',trimW:148,trimH:210,bleed:3,safeZone:10}",
        "leaflet:{size:'a4l',trimW:297,trimH:210,foldType:'3roll',gutterMargin:3,bleed:3,safeZone:10}",
        "cover:{size:'a5',trimW:148,trimH:210,paperType:'mojo80',pageCount:100,spine:5,hasWing:false,wingW:DEFAULT_WING_MM,bleed:3,safeZone:10}",
        "booklet:{size:'a5',trimW:148,trimH:210,bookletPages:8,paperType:'mojo80',bleed:3,safeZone:10}",
        "quota.canStart('print-checker')",
        "quota.commitSuccess('print-checker')",
    ):
        assert marker in source


def test_program_usage_firestore_rules_are_generic_and_bounded():
    rules = RULES.read_text(encoding="utf-8")

    for marker in (
        "function validProgramUsageLimit(programId)",
        "request.resource.data.guestLimit >= -1",
        "request.resource.data.memberLimit >= -1",
        "request.resource.data.period in ['daily','monthly']",
        "match /program_usage_limits/{programId}",
        "allow create, update: if isAdmin() && validProgramUsageLimit(programId)",
        "match /users/{uid}/program_usage/{usageKey}",
        "validProgramUsage()",
        "request.resource.data.count == 1",
        "request.resource.data.count == resource.data.count + 1",
        "request.resource.data.count <= 1000",
    ):
        assert marker in rules


def test_hosting_keeps_admin_compat_bootstrap_and_public_pdf_suite_policy():
    source = HOSTING.read_text(encoding="utf-8")

    assert "data-pdf-suite-daily-free" in source
    assert "/js/pdf-daily-free.js" in source
    assert 'ADMIN_PDF_USAGE_MARKER = "data-admin-pdf-usage-settings"' in source
    assert "/js/admin-pdf-usage-settings.js" in source
    assert "_inject_before(admin, ADMIN_PDF_USAGE_MARKER" in source


def test_usage_browser_smokes_are_wired_into_phase5():
    source = RUNNER.read_text(encoding="utf-8")

    assert "pdf-daily-free-smoke.html" in source
    assert "pdf-daily-free-config-smoke.html" in source
    assert "pdf-daily-free-admin-smoke.html" in source
    assert "admin-pdf-usage-settings-smoke.html" in source
    assert "print-checker-defaults-daily-free-smoke.html" in source
