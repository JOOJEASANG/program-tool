from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_admin_member_workflow_retires_subscription_and_usage_count_ui():
    js = read("js/admin-workflow-v2.js")
    for marker in (
        "#planFilter,#mPro,[data-plan],.badge.free,.badge.pro{display:none!important}",
        "회원·프로그램 권한 관리",
        "전체 프로그램 승인",
        "Firebase 사용량",
        "adminSubscriptionManagement='retired'",
        "stage:'admin-member-program-access-v4'",
    ):
        assert marker in js
    assert "PDF 사용횟수는 별도 메뉴" not in js


def test_admin_bulk_actions_separate_member_and_all_program_approval():
    js = read("js/admin-workflow-v2.js")
    bulk = js[js.index("async function applyBulk"):js.index("function guardDangerousActions")]
    assert 'data-bulk-status="approved"' in bulk
    assert 'data-bulk-access="all"' in bulk
    assert "programsAll:true" in bulk
    assert 'data-bulk-status="suspended"' in bulk
    assert "data-bulk-plan" not in bulk


def test_admin_program_access_control_supports_all_and_per_program_modes():
    compat = read("js/admin-pdf-usage-settings.js")
    js = read("js/admin-access-control.js")

    for marker in (
        "회원 승인",
        "전체 프로그램 승인",
        "프로그램별 권한",
        "프로그램 전체 해제",
        "programsAll:true",
        "programsAll:false",
        "data-program-access",
        "admin-program-access-v1",
    ):
        assert marker in js

    assert "admin-usage-count-retired-approval-compat-v3" in compat
    assert "admin-program-usage-settings.js" not in compat


def test_admin_firebase_usage_panel_is_separate_read_only_monitoring_view():
    source = read("js/admin-firebase-usage.js")
    assert "서버 사용량" in source
    assert "Firebase 무료할당량 사용 현황" in source
    assert "/api/admin/firebase-usage" in source
    assert "Cloud Monitoring" in source
    assert "collection('program_usage')" not in source
