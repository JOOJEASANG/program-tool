from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_admin_member_workflow_retires_subscription_management_ui():
    js = read("js/admin-workflow-v2.js")
    for marker in (
        "#planFilter,#mPro,[data-plan],.badge.free,.badge.pro{display:none!important}",
        "회원 관리",
        "PDF 사용횟수는 별도 메뉴에서 설정합니다.",
        "상세 관리는 회원 관리에서",
        "data-admin-subscription-management",
    ):
        if marker == "data-admin-subscription-management":
            assert "adminSubscriptionManagement='retired'" in js
        else:
            assert marker in js


def test_admin_bulk_actions_keep_status_controls_but_drop_plan_controls():
    js = read("js/admin-workflow-v2.js")
    bulk = js[js.index("function installBulkBar"):js.index("function guardDangerousActions")]
    assert 'data-bulk-status="approved"' in bulk
    assert 'data-bulk-status="suspended"' in bulk
    assert "data-bulk-plan" not in bulk
    assert "applyBulk('plan'" not in bulk


def test_admin_program_usage_limits_are_the_extensible_operating_quota_control():
    compat = read("js/admin-pdf-usage-settings.js")
    js = read("js/admin-program-usage-settings.js")

    assert "admin-pdf-usage-compatibility-bootstrap-v2" in compat
    assert "/js/admin-program-usage-settings.js?v=20260914-1" in compat
    assert "프로그램별 사용횟수" in js
    assert "program_usage_limits" in js
    assert "guestLimit" in js
    assert "memberLimit" in js
    assert "saveProgram" in js
    assert "saveAll" in js
    assert "addCustomProgram" in js
