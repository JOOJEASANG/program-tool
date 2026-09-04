import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def text(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def executable_js(relative: str) -> str:
    source = text(relative)
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    source = re.sub(r"//[^\n]*", "", source)
    return source


def test_functions_and_storage_transfer_limits_stay_cost_bounded():
    main = text("backend/main.py")
    rules = text("storage.rules")
    session = text("js/pdf-editor/session-save-safety.js")
    transfer = text("js/pdf-editor/transfer-limit-guard.js")
    utility = text("js/pdf-utility-cost-guard-v2.js")

    assert "PDF_STORAGE_FILE_BYTES = 200 * MIB" in main
    assert "PDF_STORAGE_TOTAL_BYTES = 300 * MIB" in main
    assert 'schedule="every 1 hours"' in main
    assert "timedelta(hours=1)" in main
    assert 'schedule="every 24 hours"' in main
    assert "ORPHAN_GRACE_HOURS = 24" in main
    assert "validPdfUpload(209715200)" in rules
    assert "MAX_FILE_BYTES = 200 * 1024 * 1024" in session
    assert "MAX_SESSION_BYTES = 300 * 1024 * 1024" in session
    assert "MAX_FILE_BYTES = 200 * 1024 * 1024" in transfer
    assert "MAX_TOTAL_BYTES = 300 * 1024 * 1024" in transfer
    compact = "".join(utility.split())
    assert "MAX_FILE_BYTES=200*1024*1024" in compact
    assert "MAX_TOTAL_BYTES=300*1024*1024" in compact
    assert "500MB" not in utility


def test_version_observer_does_not_own_pdf_runtime_modules():
    observer = executable_js("js/app-version.js")
    route = text("js/pdf-editor/route-runtime.js")
    preflight = text("js/pdf-preflight/route-runtime.js")

    route_owned_ids = (
        "pdfEditorTransferLimitGuardScriptV1",
        "pdfDividerLocalImageUploadScriptV1",
        "pdfEditorFinalCheckScriptV1",
        "pdfEditorSpreadSplitScriptV1",
        "pdfBookletSheetPreviewScriptV1",
    )
    for script_id in route_owned_ids:
        assert script_id in route
        assert script_id not in observer

    for script_id in (
        "pdfUtilityCostGuardScriptV2",
        "pdfSecurityLargeFileScriptV1",
        "pdfPreflightPanelBalanceScriptV1",
    ):
        assert script_id in preflight
        assert script_id not in observer

    assert "aiDesignFeatureGateScriptV1" not in observer
    assert "ai-design-feature-gate.js" not in observer


def test_deployment_smoke_reads_canonical_manifests_not_legacy_comments():
    smoke = text("scripts/smoke_deployment.py")
    assert '"js/pdf-editor/route-runtime.js"' in smoke
    assert "DESIGN_EDITOR_RUNTIME_SCRIPTS" not in smoke
    assert "pdf_editor_runtime_assets" in smoke


def test_preflight_runtime_is_canonical_and_current_ui_loads_last():
    runtime = text("js/pdf-preflight/route-runtime.js")
    sw = executable_js("js/sw-register.js")
    ui = executable_js("js/program-studio-ui-v2.js")
    injector = text("scripts/inject_boot_guard.py")

    assert "/js/pdf-preflight/route-runtime.js?v=20260831-1" in sw
    assert "loadPreflightRuntime" in sw
    assert "ProgramStudioPreflightRuntimeReady" in sw
    assert runtime.index("pdfUtilityScriptV1") < runtime.index("pdfPreflightPanelBalanceScriptV1")
    assert runtime.index("pdfAllInOneStage1ScriptV1") < runtime.index("pdfPreflightPanelBalanceScriptV1")
    assert runtime.index("pdfPrintReadinessScriptV1") < runtime.index("pdfPreflightPanelBalanceScriptV1")
    assert "CRITICAL_MODULES" not in runtime
    assert "DEFERRED_MODULES" not in runtime
    assert "pdfPreflightPanelBalanceScriptV1" not in ui
    assert "pdfPreflightWorkflowV2Script" not in ui
    assert "PDF_SECURITY_MARKER" not in injector
    assert not (ROOT / "js/pdf-utility-first-paint.js").exists()
    assert not (ROOT / "js/pdf-utility-cost-policy-hardening.js").exists()


def test_protected_reveal_waits_for_bounded_preflight_runtime_after_access():
    boot = text("js/app-boot-guard.js")
    assert "clean-workspace-v2" in boot
    assert "waitForPreflightFunctionalReady" in boot
    assert "ProgramStudioPreflightRuntimeReady" in boot
    assert "pdfPreflightPanelBalanceScriptV1" in boot
    assert "script.dataset.loaded='true'" in boot
    assert "if(!access){retryApprovalWait();return;}" in boot
    assert "clearTimeout(failClosedTimer)" in boot
    assert "functional-runtime" in boot
    assert "functional-timeout" in boot
    assert "waitForDesignFunctionalReady" not in boot
    assert "DesignEditorApp" not in boot
    approval = boot[boot.index("function waitForApproval()") :]
    assert approval.index("clearTimeout(failClosedTimer);") < approval.index("await waitForPreflightFunctionalReady();")
    assert approval.index("await waitForPreflightFunctionalReady();") < approval.index("reveal(functional?'functional-runtime':'functional-timeout');")
    assert "root.dataset.bootGate='access-only'" not in boot


def test_design_metadata_is_bound_to_owner_and_project_path():
    rules = text("firestore.rules")
    assert "validDesignProjectMetadata(uid, projectId)" in rules
    assert "'^design_projects/' + uid + '/' + projectId + '/" in rules


def test_saved_session_storage_requires_owner_metadata():
    rules = text("storage.rules")
    session = text("js/pdf-editor/session-save-safety.js")
    for marker in (
        "request.resource.metadata.ownerUid == userId",
        "request.resource.metadata.purpose == 'pdf-session-source'",
        "request.resource.metadata.sessionId == sessionId",
    ):
        assert marker in rules
    for marker in (
        "ownerUid: user.uid",
        "purpose: 'pdf-session-source'",
        "sessionId,",
    ):
        assert marker in session


def test_quota_cleanup_drops_firestore_reference_before_blob_deletion():
    main = text("backend/main.py")
    delete_document = main.index("snapshot.reference.delete()")
    delete_blobs = main.index("_delete_blob_paths(bucket, paths)", delete_document)
    assert delete_document < delete_blobs
    assert "referenced.update(paths)" in main[delete_document:delete_blobs]
