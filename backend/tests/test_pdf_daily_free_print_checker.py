from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
QUOTA = ROOT / "js" / "pdf-daily-free.js"
ACCESS = ROOT / "js" / "print-checker" / "access.js"
DEFAULTS = ROOT / "js" / "print-checker" / "defaults-live.js"
PRINT_HTML = ROOT / "print-checker" / "index.html"
HOSTING = ROOT / "scripts" / "prepare_hosting_dist.py"
RULES = ROOT / "firestore.rules"
RUNNER = ROOT / "scripts" / "run_phase5_browser_smoke.sh"


def test_daily_free_policy_has_guest_and_member_limits_and_success_commit():
    source = QUOTA.read_text(encoding="utf-8")

    for marker in (
        "const GUEST_LIMIT=3",
        "const MEMBER_LIMIT=10",
        "programStudioPdfGuestId",
        "programStudioPdfUsage:guest:",
        "daily_pdf_usage",
        "runTransaction",
        "async function canStart",
        "async function commitSuccess",
        "program-pdf-daily-free-commit",
        "비회원 무료",
        "로그인 무료",
        "SUITE_ACTION_SELECTOR",
        "a[download]",
        "blob:",
    ):
        assert marker in source

    can_start = source.index("async function canStart")
    commit = source.index("async function commitSuccess")
    assert can_start < commit
    assert "commitSuccess(actionName(node))" not in source


def test_print_checker_is_public_daily_free_and_loads_default_live_runtime():
    access = ACCESS.read_text(encoding="utf-8")
    html = PRINT_HTML.read_text(encoding="utf-8")

    assert "guardTool" not in access
    assert "approval-waiting" not in access
    assert "daily-free" in access
    assert "guestLimit:3" in access
    assert "memberLimit:10" in access

    assert "/js/pdf-daily-free.js?v=20260906-1" in html
    assert "/js/print-checker/defaults-live.js?v=20260906-1" in html
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
        "flyer:{size:'a4',trimW:210,trimH:297,bleed:3,safeZone:3}",
        "invitation:{size:'a5',trimW:148,trimH:210,bleed:3,safeZone:3}",
        "leaflet:{size:'a4l',trimW:297,trimH:210,foldType:'3roll',gutterMargin:3,bleed:3,safeZone:3}",
        "cover:{size:'a5',trimW:148,trimH:210,paperType:'mojo80',pageCount:100,spine:5,hasWing:false,wingW:90,bleed:3,safeZone:3}",
        "booklet:{size:'a5',trimW:148,trimH:210,bookletPages:8,paperType:'mojo80',bleed:3,safeZone:3}",
        "printSizePreset",
        "matchingPreset",
        "notifyCore",
        "updateSummary",
        "selectProduct?.('flyer'",
        "quota.canStart('print-checker')",
        "quota.commitSuccess('print-checker')",
    ):
        assert marker in source


def test_member_counter_firestore_rule_is_owner_only_increment_and_bounded():
    rules = RULES.read_text(encoding="utf-8")

    for marker in (
        "match /users/{uid}/daily_pdf_usage/{dateKey}",
        "allow read: if isOwner(uid)",
        "request.resource.data.count == 1",
        "request.resource.data.count == resource.data.count + 1",
        "request.resource.data.count <= 10",
        "allow delete: if false",
    ):
        assert marker in rules


def test_hosting_stages_public_daily_free_suite_without_approval_guard():
    source = HOSTING.read_text(encoding="utf-8")

    assert "data-pdf-suite-daily-free" in source
    assert "/js/pdf-daily-free.js?v=20260906-1" in source
    assert "guardTool" not in source
    assert "approval-waiting" not in source


def test_daily_free_browser_smokes_are_wired_into_phase5():
    source = RUNNER.read_text(encoding="utf-8")

    assert "pdf-daily-free-smoke.html" in source
    assert "print-checker-defaults-daily-free-smoke.html" in source
