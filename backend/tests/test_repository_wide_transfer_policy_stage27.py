import re
from pathlib import Path

from routers import pdf_utility as pdf_utility_router


ROOT = Path(__file__).resolve().parents[2]
SW_REGISTER = ROOT / "js" / "sw-register.js"
APP_VERSION = ROOT / "js" / "app-version.js"
PREFLIGHT_RUNTIME = ROOT / "js" / "pdf-preflight" / "route-runtime.js"
DIVIDER_UPLOAD = ROOT / "js" / "pdf-divider-local-image-upload.js"
EDITOR_POLICY = ROOT / "js" / "pdf-editor" / "transfer-limit-guard.js"
SESSION_SAVE = ROOT / "js" / "pdf-editor" / "session-save-safety.js"
UTILITY_POLICY = ROOT / "js" / "pdf-utility-cost-guard-v2.js"
ADMIN_GUARD = ROOT / "js" / "admin-program-catalog-nav-guard.js"
STORAGE_RULES = ROOT / "storage.rules"
STORAGE_LIFECYCLE = ROOT / "storage-lifecycle.json"
MAIN = ROOT / "backend" / "main.py"
PDF_UTILITY = ROOT / "backend" / "routers" / "pdf_utility.py"

MB = 1024 * 1024


def executable_js(path: Path) -> str:
    source = path.read_text(encoding="utf-8")
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    source = re.sub(r"//[^\n]*", "", source)
    return source


def test_storage_backed_pdf_policy_is_200mb_file_300mb_job_with_bounded_compute():
    assert pdf_utility_router.MAX_FILE_BYTES == 200 * MB
    assert pdf_utility_router.MAX_TOTAL_BYTES == 300 * MB
    assert pdf_utility_router.MAX_BACKGROUND_PAGES == 100
    assert pdf_utility_router.MAX_BACKGROUND_PIXELS == 90_000_000
    assert pdf_utility_router.BACKGROUND_DPI == 160

    main = MAIN.read_text(encoding="utf-8")
    assert "PDF_STORAGE_FILE_BYTES = 200 * MIB" in main
    assert "PDF_STORAGE_TOTAL_BYTES = 300 * MIB" in main
    assert "min_instances=0" in main
    assert "max_instances=2" in main


def test_pdf_utility_large_storage_routes_use_disk_not_multi_file_memory_buffers():
    source = PDF_UTILITY.read_text(encoding="utf-8")
    merge = source[source.index('def merge_storage(uid):'):source.index('@pdf_utility_bp.route("/background-cleanup-storage"')]
    background = source[source.index('def background_cleanup_storage(uid):'):]
    assert "download_to_filename" in source
    assert "_download_storage_pdf_to_path" in merge
    assert "_merge_pdf_paths" in merge
    assert "items: list[tuple[str, bytes]]" not in merge
    assert "_download_storage_pdf_to_path" in background
    assert "_clean_background_pdf_path" in background
    assert "shutil.rmtree" in source


def test_retired_cover_large_file_runtime_policy_is_removed():
    assert not (ROOT / "js" / "cover-large-file-policy.js").exists()
    for source in (SW_REGISTER.read_text(encoding="utf-8"), APP_VERSION.read_text(encoding="utf-8")):
        assert "cover-large-file-policy.js" not in source
        assert "coverLargeFilePolicyScriptV1" not in source


def test_divider_source_upload_is_local_only_and_internal_embedding_is_bounded():
    source = DIVIDER_UPLOAD.read_text(encoding="utf-8")
    assert "MAX_EMBED_BYTES = 5 * 1024 * 1024" in source
    assert "MAX_TOTAL_EMBED_BYTES = 15 * 1024 * 1024" in source
    assert "MAX_SOURCE_PIXELS = 80_000_000" in source
    assert "MAX_EMBED_PIXELS = 20_000_000" in source
    assert "createImageBitmap" in source
    assert "URL.createObjectURL(file)" in source
    assert "optimizeFile" in source
    assert "readAsDataURL(file)" not in source
    assert "maxEmbeddedBytes: MAX_EMBED_BYTES" in source


def test_pdf_editor_session_and_utility_enforce_cost_bounded_working_sets():
    editor = EDITOR_POLICY.read_text(encoding="utf-8")
    session = SESSION_SAVE.read_text(encoding="utf-8")
    utility = UTILITY_POLICY.read_text(encoding="utf-8")

    assert "MAX_FILE_BYTES = 200 * 1024 * 1024" in editor
    assert "MAX_TOTAL_BYTES = 300 * 1024 * 1024" in editor
    assert "document.addEventListener('change', onChange, true)" in editor
    assert "document.addEventListener('drop', onDrop, true)" in editor

    assert "MAX_FILE_BYTES = 200 * 1024 * 1024" in session
    assert "MAX_SESSION_BYTES = 300 * 1024 * 1024" in session
    assert "totalBytes: snapshotMeta.totalBytes" in session
    assert "원본 PDF 전체 합계는 최대 300MB" in session

    compact = "".join(utility.split())
    assert "constMAX_FILE_BYTES=200*1024*1024" in compact
    assert "constMAX_TOTAL_BYTES=300*1024*1024" in compact
    assert "500MB" not in utility


def test_storage_rules_keep_temp_pdf_owner_scoped_and_backend_access_bounded():
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    assert "validPdfUpload(209715200)" in rules
    pdf_temp = rules[rules.index("match /pdf_temp/"):rules.index("match /preflight_temp/")]
    preflight_temp = rules[rules.index("match /preflight_temp/"):rules.index("match /pdf_sessions/")]
    assert "allow read: if isOwner(userId);" in pdf_temp
    assert "allow delete: if isOwner(userId);" in pdf_temp
    assert "canUseProgram(" not in pdf_temp
    assert "validStagePath(sessionId, fileName)" in pdf_temp
    assert "validPdfUpload(209715200)" in pdf_temp
    assert "allow update: if false;" in pdf_temp
    assert "allow read: if isOwner(userId);" in preflight_temp
    assert "allow delete: if isOwner(userId);" in preflight_temp
    assert "canUseProgram(" not in preflight_temp
    assert "validStagePath(sessionId, fileName)" in preflight_temp
    assert "validPdfUpload(209715200)" in preflight_temp
    assert "allow update: if false;" in preflight_temp
    assert "require_program_access_for_request" in MAIN.read_text(encoding="utf-8")
    results = rules[rules.index("match /pdf_results/"):rules.index("match /design_projects/")]
    assert "allow read: if isOwner(userId);" in results
    assert "allow delete: if isOwner(userId);" in results
    assert "canUseProgram(" not in results
    assert "allow create, update: if false;" in results


def test_persistent_pdf_sessions_are_not_accidentally_put_in_temp_lifecycle():
    lifecycle = STORAGE_LIFECYCLE.read_text(encoding="utf-8")
    main = MAIN.read_text(encoding="utf-8")
    assert '"pdf_temp/"' in lifecycle
    assert '"preflight_temp/"' in lifecycle
    assert '"pdf_results/"' in lifecycle
    assert '"pdf_sessions/"' not in lifecycle
    assert 'schedule="every 24 hours"' in main
    assert '"pdf_sessions"' in main
    assert '"design_projects"' in main


def test_active_runtime_uses_single_pdf_and_preflight_owners():
    sw = executable_js(SW_REGISTER)
    app = executable_js(APP_VERSION)
    preflight = PREFLIGHT_RUNTIME.read_text(encoding="utf-8")

    assert "/js/pdf-editor/route-runtime.js?v=20260828-1" in sw
    assert "pdf-editor/transfer-limit-guard.js" not in sw
    assert "pdf-divider-local-image-upload.js" not in sw
    assert "pdfEditorTransferLimitGuardScriptV1" not in app
    assert "pdfDividerLocalImageUploadScriptV1" not in app

    assert "/js/pdf-preflight/route-runtime.js?v=20260831-1" in sw
    assert "pdfUtilityCostGuardScriptV2" in preflight
    assert "pdfPreflightPanelBalanceScriptV1" in preflight
    assert "pdfUtilityCostGuardScriptV2" not in app
    assert "pdfPreflightPanelBalanceScriptV1" not in app
    assert "pdf-utility-first-paint.js" not in app
    assert "cover-large-file-policy.js" not in sw
    assert "cover-large-file-policy.js" not in app


def test_admin_catalog_menu_has_late_dependency_recovery():
    source = ADMIN_GUARD.read_text(encoding="utf-8")
    assert "AdminProgramCatalogManager" in source
    assert "auth.onAuthStateChanged" in source
    assert "attempts < 60" in source
    assert "adminProgramCatalogNav" in source
