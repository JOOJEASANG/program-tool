from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
POLICY = ROOT / "js" / "pdf-daily-free.js"
CATALOG = ROOT / "js" / "program-usage-catalog.js"
OUTPUT_GUARD = ROOT / "js" / "program-usage-output-guard.js"
ACCESS = ROOT / "js" / "print-checker" / "access.js"
DEFAULTS = ROOT / "js" / "print-checker" / "defaults-live.js"
ADMIN_ACCESS = ROOT / "js" / "admin-access-control.js"
ADMIN_COMPAT = ROOT / "js" / "admin-pdf-usage-settings.js"
ADMIN_USAGE = ROOT / "js" / "admin-firebase-usage.js"
FIREBASE_CONFIG = ROOT / "js" / "firebase-config.js"
PDF_ROUTE = ROOT / "js" / "pdf-editor" / "route-runtime.js"
ADVANCED_BOOT = ROOT / "js" / "pdf-editor-advanced" / "firebase-bootstrap.js"
HOSTING = ROOT / "scripts" / "prepare_hosting_dist.py"
RULES = ROOT / "firestore.rules"
RUNNER = ROOT / "scripts" / "run_phase5_browser_smoke.sh"


def test_program_usage_catalog_still_covers_current_programs_for_compatibility():
    source = CATALOG.read_text(encoding="utf-8")
    for marker in (
        "function register(entry)",
        "function resolve(pathname=location.pathname)",
        "'print-checker'",
        "'smart-print-layout'",
        "'pdf-editor'",
        "'pdf-editor-advanced'",
        "'pdf-preflight'",
    ):
        assert marker in source


def test_historical_usage_policy_filename_now_enforces_admin_approval_only():
    source = POLICY.read_text(encoding="utf-8")
    for marker in (
        "ProgramAccess.canUseProgram",
        "mode:'signed-out'",
        "관리자 승인 후 이 프로그램을 사용할 수 있습니다.",
        "프로그램 권한 승인을 요청해 주세요.",
        "window.ProgramUsagePolicy=Object.freeze(policy)",
        "window.ProgramPdfDailyFree=window.ProgramUsagePolicy",
        "stage:'program-access-policy-v4-admin-approval'",
        "programUsagePolicy='approval-only'",
        "pdfDailyFree='retired'",
    ):
        assert marker in source

    for retired in (
        "programStudioUsage:guest:",
        "programStudioUsage:member:",
        "collection('program_usage')",
        "guestLimit",
        "memberLimit",
        "increment(",
    ):
        assert retired not in source


def test_result_generation_guard_keeps_compatibility_but_no_longer_decrements_usage():
    guard = OUTPUT_GUARD.read_text(encoding="utf-8")
    policy = POLICY.read_text(encoding="utf-8")
    assert "policy.forProgram(programId)" in guard
    assert "api.canStart(action)" in guard
    assert "commitSuccess(item.action)" in guard
    assert "a[download]" in guard
    assert "async function commitSuccess" in policy
    assert "return accessStatus(programId)" in policy
    assert "program_usage" not in policy


def test_program_access_catalog_and_route_mapping_include_every_current_tool():
    source = FIREBASE_CONFIG.read_text(encoding="utf-8")
    for marker in (
        "PROGRAM_ACCESS_CATALOG",
        "'print-checker'",
        "'smart-print-layout'",
        "'pdf-editor'",
        "'pdf-editor-advanced'",
        "'pdf-preflight'",
        "programsAll: false",
        "profile.programsAll === true",
        "profile.programs && profile.programs[programId] === true",
    ):
        assert marker in source

    assert "return 'print-checker'" in source
    assert "return 'smart-print-layout'" in source
    assert "return 'pdf-editor-advanced'" in source
    assert "return 'pdf-preflight'" in source


def test_admin_can_approve_whole_account_all_programs_or_individual_programs():
    source = ADMIN_ACCESS.read_text(encoding="utf-8")
    compat = ADMIN_COMPAT.read_text(encoding="utf-8")
    for marker in (
        "회원 승인",
        "전체 프로그램 승인",
        "프로그램별 권한",
        "프로그램 전체 해제",
        "programsAll:true",
        "programsAll:false",
        "programs.${p.id}",
        "admin-program-access-v1",
    ):
        assert marker in source
    assert "admin-usage-count-retired-approval-compat-v3" in compat
    assert "admin-program-usage-settings.js" not in compat


def test_print_checker_is_no_longer_public_or_daily_free():
    source = ACCESS.read_text(encoding="utf-8")
    assert "mode:'admin-approved'" in source
    assert "programId:'print-checker'" in source
    assert "daily-free" not in source
    assert "하루" not in source
    assert "비회원" not in source


def test_print_checker_defaults_keep_processing_guard_compatibility():
    source = DEFAULTS.read_text(encoding="utf-8")
    assert "quota.canStart('print-checker')" in source
    assert "quota.commitSuccess('print-checker')" in source
    assert "A4 · 210 × 297 mm" in source


def test_firestore_rules_require_account_and_program_approval_and_retire_counters():
    rules = RULES.read_text(encoding="utf-8")
    for marker in (
        "function programApproved(uid, programId)",
        "data.status == 'approved'",
        "data.programsAll == true",
        "data.programs[programId] == true",
        "request.resource.data.programsAll == false",
        "request.resource.data.programs['print-checker'] == false",
        "request.resource.data.programs['pdf-editor-advanced'] == false",
        "match /users/{uid}/program_usage/{usageKey}",
        "allow create, update, delete: if false;",
        "programApproved(uid, 'pdf-editor')",
        "programApproved(uid, 'pdf-editor-advanced')",
        "programApproved(uid, 'smart-print-layout')",
    ):
        assert marker in rules


def test_current_pdf_routes_still_load_shared_result_guard_and_divider_tools():
    route = PDF_ROUTE.read_text(encoding="utf-8")
    advanced = ADVANCED_BOOT.read_text(encoding="utf-8")
    assert "programUsageOutputGuardScriptV1" in route
    assert "/js/program-usage-output-guard.js?v=20260914-1" in route
    assert "/js/pdf-editor/divider-design-tools.js?v=20260914-1" in route
    assert "pdf-editor-route-runtime-manifest-v4-divider-design-tools" in route
    assert "loadUsageOutputGuard" in advanced


def test_admin_firebase_usage_panel_uses_monitoring_instead_of_firestore_counters():
    source = ADMIN_USAGE.read_text(encoding="utf-8")
    for marker in (
        "Firebase 무료할당량 사용 현황",
        "/api/admin/firebase-usage",
        "setInterval",
        "60000",
        "usageCountersRetired",
        "Cloud Monitoring",
    ):
        assert marker in source
    assert "collection('program_usage')" not in source


def test_hosting_compat_bootstraps_remain_available_during_migration():
    source = HOSTING.read_text(encoding="utf-8")
    assert "/js/pdf-daily-free.js" in source
    assert "/js/admin-pdf-usage-settings.js" in source


def test_new_approval_and_divider_browser_smokes_are_wired_into_phase5():
    source = RUNNER.read_text(encoding="utf-8")
    for page in (
        "program-access-approval-smoke.html",
        "admin-access-control-smoke.html",
        "divider-design-tools-smoke.html",
        "admin-firebase-usage-smoke.html",
    ):
        assert page in source
    for retired in (
        "pdf-daily-free-smoke.html",
        "pdf-daily-free-config-smoke.html",
        "pdf-daily-free-admin-smoke.html",
        "print-checker-defaults-daily-free-smoke.html",
        "admin-pdf-usage-settings-smoke.html",
    ):
        assert retired not in source
