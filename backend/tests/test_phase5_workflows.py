from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GLOBAL_UI = ROOT / "js" / "program-studio-ui-v2.js"
HOME = ROOT / "js" / "home-dashboard-v2.js"
ADMIN = ROOT / "js" / "admin-workflow-v2.js"
PREFLIGHT = ROOT / "js" / "pdf-preflight" / "workflow-v2.js"


def test_global_ui_loads_phase5_enhancements_by_surface():
    text = GLOBAL_UI.read_text(encoding="utf-8")
    for marker in (
        "surface==='home'",
        "/js/home-dashboard-v2.js?v=20260828-1",
        "surface==='admin'",
        "/js/admin-workflow-v2.js?v=20260828-1",
        "surface==='pdf-preflight'",
        "/js/pdf-preflight/workflow-v2.js?v=20260828-1",
    ):
        assert marker in text


def test_home_workspace_has_search_favorites_recent_and_no_polling():
    text = HOME.read_text(encoding="utf-8")
    for marker in (
        "QUICK WORKSPACE",
        "바로 작업 시작",
        "ps-home-search",
        "FAVORITES_KEY",
        "RECENT_KEY",
        "toggleFavorite",
        "markRecent",
        "event.key==='/'",
    ):
        assert marker in text
    assert "setInterval(" not in text
    assert "innerHTML=p." not in text


def test_admin_workflow_makes_recent_members_read_only_and_confirms_bulk_changes():
    text = ADMIN.read_text(encoding="utf-8")
    for marker in (
        "#recentMembers .item>.btn{display:none!important}",
        "button.disabled=true",
        "admin-member-select",
        "applyBulk",
        "confirm(`${ids.length}명의 ${label}을(를) 변경할까요?`)",
        "data-status=\"suspended\"",
        "event.stopImmediatePropagation()",
    ):
        assert marker in text
    assert "setInterval(" not in text


def test_admin_bulk_update_reuses_firestore_without_replacing_existing_admin_renderer():
    text = ADMIN.read_text(encoding="utf-8")
    assert "window.db.collection('user_permissions').doc(id).set" in text
    assert "$('refreshBtn')?.click()" in text
    for marker in ("function row(", "function renderMembers(", "function loadMembers("):
        assert marker not in text


def test_preflight_prioritizes_fail_warning_pass_and_supports_filters():
    text = PREFLIGHT.read_text(encoding="utf-8")
    assert "ORDER={fail:0,warning:1,pass:2,unknown:3}" in text
    for marker in (
        "문제 0",
        "확인 0",
        "정상 0",
        "우선 수정 필요",
        "확인 권장",
        "preflight-filter-hidden",
        "MutationObserver(queueSync)",
    ):
        assert marker in text
    assert "setInterval(" not in text
    assert "runTool(" not in text
