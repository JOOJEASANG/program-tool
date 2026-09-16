from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_admin_member_workflow_is_status_only():
    html = read("admin.html")
    js = read("js/admin-workflow-v2.js")

    for marker in ("회원 관리", "승인된 회원", "이용 중지"):
        assert marker in html or marker in js

    for retired in ("planFilter", "mPro", "data-plan", "FREE", "PRO 구독"):
        assert retired not in html


def test_admin_bulk_actions_only_change_approval_status():
    js = read("js/admin-workflow-v2.js")
    assert 'data-bulk-status="approved"' in js
    assert 'data-bulk-status="suspended"' in js
    assert "data-bulk-plan" not in js
    assert "applyBulk('plan'" not in js
    assert "user_permissions" in js


def test_admin_usage_limit_modules_are_retired_compatibility_shims():
    compat = read("js/admin-pdf-usage-settings.js")
    settings = read("js/admin-program-usage-settings.js")

    assert "admin-usage-limits-retired" in compat
    assert "admin-program-usage-limits-retired" in settings
    assert "program_usage_limits" not in compat
    assert "program_usage_limits" not in settings
    assert "guestLimit" not in settings
    assert "memberLimit" not in settings
    assert "document.getElementById('adminProgramUsageNav')?.remove()" in compat
