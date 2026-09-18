from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; GLOBAL_UI=ROOT/"js"/"program-studio-ui-v2.js"; HOME=ROOT/"index.html"; ADMIN=ROOT/"js"/"admin-workflow-v2.js"; PREFLIGHT=ROOT/"js"/"pdf-preflight"/"workflow-v2.js"; PREFLIGHT_RUNTIME=ROOT/"js"/"pdf-preflight"/"route-runtime.js"
def test_phase5_enhancements_have_single_surface_owners():
 text=GLOBAL_UI.read_text(encoding="utf-8"); runtime=PREFLIGHT_RUNTIME.read_text(encoding="utf-8"); assert "surface==='admin'" in text and "/js/admin-workflow-v2.js?v=20260916-1" in text and "window.__adminWorkflowApprovedOnlyV1" in text and "surface==='pdf-preflight'" in text and "surface==='home'" in text; assert "/js/home-dashboard-v2.js" not in text and "/js/pdf-preflight/workflow-v2.js" not in text; assert "pdfPreflightWorkflowV2Script" in runtime and "/js/pdf-preflight/workflow-v2.js?v=20260831-1" in runtime
def test_home_workspace_is_static_searchable_and_has_only_live_programs():
 text=HOME.read_text(encoding="utf-8")
 for marker in ('data-home-static-professional="1"',"디자인 검토","AI 디자인 제작","PDF배치","PDF편집","PDF 도구 모음","search","prog-card"): assert marker in text
 for retired in ("디자인 편집기","문서 편집기","이미지 편집기"): assert retired not in text
def test_admin_workflow_supports_approval_only_bulk_changes():
 text=ADMIN.read_text(encoding="utf-8")
 for marker in ("admin-member-select","applyBulk","data-bulk-status=\"approved\"","data-bulk-status=\"suspended\"","계정을 이용 중지할까요?","button.disabled=busy||selected.size===0","window.ProgramAccess?.clearCache?.(id)"): assert marker in text
 for retired in ("data-bulk-plan","applyBulk('plan'","FREE","PRO","program_usage_limits"): assert retired not in text
 assert "setInterval(" not in text
def test_admin_bulk_update_reuses_firestore_without_replacing_existing_admin_renderer():
 text=ADMIN.read_text(encoding="utf-8"); assert "window.db.collection('user_permissions').doc(id).set" in text and "$('refreshBtn')?.click()" in text
 for marker in ("function row(","function renderMembers(","function loadMembers("): assert marker not in text
def test_preflight_prioritizes_fail_warning_pass_and_supports_filters():
 text=PREFLIGHT.read_text(encoding="utf-8"); assert "ORDER={fail:0,warning:1,pass:2,unknown:3}" in text
 for marker in ("문제 0","확인 0","정상 0","우선 수정 필요","확인 권장","preflight-filter-hidden","MutationObserver(queueSync)"): assert marker in text
 assert "setInterval(" not in text and "runTool(" not in text
