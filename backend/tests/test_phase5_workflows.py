from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; GLOBAL_UI=ROOT/"js"/"program-studio-ui-v2.js"; HOME=ROOT/"index.html"; ADMIN=ROOT/"js"/"admin-workflow-v2.js"; PREFLIGHT=ROOT/"js"/"pdf-preflight"/"workflow-v2.js"; PREFLIGHT_RUNTIME=ROOT/"js"/"pdf-preflight"/"route-runtime.js"
def test_phase5_enhancements_have_single_surface_owners():
 text=GLOBAL_UI.read_text(encoding="utf-8"); runtime=PREFLIGHT_RUNTIME.read_text(encoding="utf-8"); assert "surface==='admin'" in text and "/js/admin-workflow-v2.js?v=20260828-1" in text and "surface==='pdf-preflight'" in text and "surface==='home'" in text; assert "/js/home-dashboard-v2.js" not in text and "/js/pdf-preflight/workflow-v2.js" not in text; assert "pdfPreflightWorkflowV2Script" in runtime and "/js/pdf-preflight/workflow-v2.js?v=20260831-1" in runtime
def test_home_workspace_is_static_searchable_and_has_only_live_programs():
 text=HOME.read_text(encoding="utf-8")
 for marker in ('data-home-static-professional="1"',"인쇄물 사전 검토","PDF 편집 · 인쇄배치","PDF 도구 모음","search","prog-card"): assert marker in text
 for retired in ("디자인 편집기","문서 편집기","이미지 편집기"): assert retired not in text
def test_admin_workflow_makes_recent_members_read_only_and_confirms_bulk_changes():
 text=ADMIN.read_text(encoding="utf-8")
 for marker in ("#recentMembers .item>.btn{display:none!important}","button.disabled=true","admin-member-select","applyBulk","confirm(`${ids.length}명의 ${label}을(를) 변경할까요?`)","data-status=\"suspended\"","event.stopImmediatePropagation()"): assert marker in text
 assert "setInterval(" not in text
def test_admin_bulk_update_reuses_firestore_without_replacing_existing_admin_renderer():
 text=ADMIN.read_text(encoding="utf-8"); assert "window.db.collection('user_permissions').doc(id).set" in text and "$('refreshBtn')?.click()" in text
 for marker in ("function row(","function renderMembers(","function loadMembers("): assert marker not in text
def test_preflight_prioritizes_fail_warning_pass_and_supports_filters():
 text=PREFLIGHT.read_text(encoding="utf-8"); assert "ORDER={fail:0,warning:1,pass:2,unknown:3}" in text
 for marker in ("문제 0","확인 0","정상 0","우선 수정 필요","확인 권장","preflight-filter-hidden","MutationObserver(queueSync)"): assert marker in text
 assert "setInterval(" not in text and "runTool(" not in text
