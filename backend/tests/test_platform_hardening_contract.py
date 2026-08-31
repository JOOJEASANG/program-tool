from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def text(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_functions_and_storage_transfer_limits_stay_cost_bounded():
    main = text("backend/main.py")
    rules = text("storage.rules")
    session = text("js/pdf-editor/session-save-safety.js")
    transfer = text("js/pdf-editor/transfer-limit-guard.js")

    assert "PDF_STORAGE_FILE_BYTES = 200 * MIB" in main
    assert "PDF_STORAGE_TOTAL_BYTES = 300 * MIB" in main
    assert 'schedule="every 1 hours"' in main
    assert "timedelta(hours=1)" in main
    assert "validPdfUpload(209715200)" in rules
    assert "MAX_FILE_BYTES = 200 * 1024 * 1024" in session
    assert "MAX_SESSION_BYTES = 300 * 1024 * 1024" in session
    assert "MAX_FILE_BYTES = 200 * 1024 * 1024" in transfer
    assert "MAX_TOTAL_BYTES = 300 * 1024 * 1024" in transfer


def test_version_observer_does_not_own_pdf_runtime_modules():
    observer = text("js/app-version.js")
    route = text("js/pdf-editor/route-runtime.js")

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


def test_deployment_smoke_reads_canonical_manifests_not_legacy_comments():
    smoke = text("scripts/smoke_deployment.py")

    assert '"js/design-editor/core-runtime.js"' in smoke
    assert '"js/pdf-editor/route-runtime.js"' in smoke
    assert "DESIGN_EDITOR_RUNTIME_SCRIPTS" not in smoke
    assert "pdf_editor_runtime_assets" in smoke


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
