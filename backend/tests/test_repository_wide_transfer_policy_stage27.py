from pathlib import Path

from routers import pdf_utility as pdf_utility_router


ROOT = Path(__file__).resolve().parents[2]
SW_REGISTER = ROOT / "js" / "sw-register.js"
APP_VERSION = ROOT / "js" / "app-version.js"
COVER_POLICY = ROOT / "js" / "cover-large-file-policy.js"
DIVIDER_UPLOAD = ROOT / "js" / "pdf-divider-local-image-upload.js"
EDITOR_POLICY = ROOT / "js" / "pdf-editor" / "transfer-limit-guard.js"
SESSION_SAVE = ROOT / "js" / "pdf-editor" / "session-save-safety.js"
ADMIN_GUARD = ROOT / "js" / "admin-program-catalog-nav-guard.js"
STORAGE_RULES = ROOT / "storage.rules"
STORAGE_LIFECYCLE = ROOT / "storage-lifecycle.json"
MAIN = ROOT / "backend" / "main.py"
PDF_UTILITY = ROOT / "backend" / "routers" / "pdf_utility.py"

MB = 1024 * 1024


def test_storage_backed_pdf_policy_is_500mb_with_bounded_compute():
    assert pdf_utility_router.MAX_FILE_BYTES == 500 * MB
    assert pdf_utility_router.MAX_TOTAL_BYTES == 500 * MB
    assert pdf_utility_router.MAX_BACKGROUND_PAGES == 100
    assert pdf_utility_router.MAX_BACKGROUND_PIXELS == 90_000_000
    assert pdf_utility_router.BACKGROUND_DPI == 160

    main = MAIN.read_text(encoding="utf-8")
    assert "PDF_STORAGE_TRANSFER_BYTES = 500 * 1024 * 1024" in main
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


def test_cover_source_upload_accepts_500mb_without_base64_source_copy():
    source = COVER_POLICY.read_text(encoding="utf-8")
    assert "MAX_SOURCE_BYTES = 500 * 1024 * 1024" in source
    assert "MAX_DECODED_PIXELS = 50_000_000" in source
    assert "URL.createObjectURL(file)" in source
    assert "readAsDataURL(file)" not in source
    assert "window.loadImageFile = loadImageFile500" in source


def test_divider_source_upload_accepts_500mb_then_bounded_internal_embedding():
    source = DIVIDER_UPLOAD.read_text(encoding="utf-8")
    assert "MAX_SOURCE_BYTES = 500 * 1024 * 1024" in source
    assert "MAX_EMBED_BYTES = 5 * 1024 * 1024" in source
    assert "MAX_SOURCE_PIXELS = 80_000_000" in source
    assert "MAX_EMBED_PIXELS = 20_000_000" in source
    assert "createImageBitmap" in source
    assert "URL.createObjectURL(file)" in source
    assert "optimizeFile" in source
    assert "readAsDataURL(file)" not in source
    assert "maxEmbeddedBytes: MAX_EMBED_BYTES" in source


def test_pdf_editor_and_persistent_session_each_enforce_500mb_working_set():
    editor = EDITOR_POLICY.read_text(encoding="utf-8")
    session = SESSION_SAVE.read_text(encoding="utf-8")

    assert "MAX_FILE_BYTES = 500 * 1024 * 1024" in editor
    assert "MAX_TOTAL_BYTES = 500 * 1024 * 1024" in editor
    assert "document.addEventListener('change', onChange, true)" in editor
    assert "document.addEventListener('drop', onDrop, true)" in editor

    assert "MAX_SESSION_BYTES = 500 * 1024 * 1024" in session
    assert "totalBytes: snapshotMeta.totalBytes" in session
    assert "원본 PDF 전체 합계는 최대 500MB" in session


def test_storage_rules_allow_500mb_pdf_but_only_server_creates_results():
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    assert "request.resource.size <= 524288000" in rules
    results = rules[rules.index("match /pdf_results/"):rules.index("match /cover_templates/")]
    assert "allow delete: if isOwner(userId);" in results
    assert "allow create, update: if false;" in results


def test_persistent_pdf_sessions_are_not_accidentally_put_in_temp_lifecycle():
    lifecycle = STORAGE_LIFECYCLE.read_text(encoding="utf-8")
    assert '"pdf_temp/"' in lifecycle
    assert '"preflight_temp/"' in lifecycle
    assert '"pdf_results/"' in lifecycle
    assert '"pdf_sessions/"' not in lifecycle


def test_both_runtime_loaders_apply_repo_wide_guards():
    sw = SW_REGISTER.read_text(encoding="utf-8")
    app = APP_VERSION.read_text(encoding="utf-8")
    markers = (
        "admin-program-catalog-nav-guard.js",
        "pdf-editor/transfer-limit-guard.js",
        "pdf-divider-local-image-upload.js?v=20260818-2",
        "cover-large-file-policy.js",
    )
    for marker in markers:
        assert marker in sw
        assert marker in app


def test_admin_catalog_menu_has_late_dependency_recovery():
    source = ADMIN_GUARD.read_text(encoding="utf-8")
    assert "AdminProgramCatalogManager" in source
    assert "auth.onAuthStateChanged" in source
    assert "attempts < 60" in source
    assert "adminProgramCatalogNav" in source
