import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_cover_image_effects_use_the_shared_lexical_state() -> None:
    source = _read("js/cover-editor-image-tools.js")
    assert "typeof state==='undefined'" in source
    assert "typeof window.state==='undefined'" not in source


def test_cover_templates_are_local_only_and_do_not_query_provider_images() -> None:
    source = _read("js/cover-template-manager.js")
    rules = _read("firestore.rules")
    assert "cover_templates" not in source
    assert "collection.where('isPublic','==',true).orderBy('name')" not in source
    assert "db.collection" not in source
    assert "firebase.storage" not in source
    assert "local-presets-only" in source
    assert "match /cover_templates/{templateId}" in rules
    assert "allow read, delete: if isAdmin();" in rules
    assert "allow create, update: if false;" in rules
    assert (ROOT / "firestore.indexes.json").exists()


def test_cover_output_is_lossless_and_described_as_rgb_raster() -> None:
    source = _read("perfect-binding-cover/index.html")
    assert "300DPI RGB PDF" in source
    assert "RGB 래스터 PDF" in source
    assert "doc.addImage(out,'PNG'" in source
    assert "toDataURL('image/jpeg'" not in source
    assert "인쇄용 PDF 만들기" not in source


def test_csp_is_enforced_and_runtime_eval_is_absent() -> None:
    firebase = _read("firebase.json")
    editor = _read("pdf-editor/index.html")
    assert '"key": "Content-Security-Policy"' in firebase
    assert "Content-Security-Policy-Report-Only" not in firebase
    assert "eval(" not in editor


def test_google_auth_dependencies_are_allowed_by_csp() -> None:
    firebase = _read("firebase.json")
    assert "https://apis.google.com" in firebase
    assert "https://accounts.google.com" in firebase
    assert "https://*.googleapis.com" in firebase
    assert "https://*.firebaseapp.com" in firebase
    assert "frame-src 'self'" in firebase


def test_clean_urls_revalidate_after_each_deployment() -> None:
    config = json.loads(_read("firebase.json"))
    global_headers = next(
        entry["headers"]
        for entry in config["hosting"]["headers"]
        if entry["source"] == "**"
    )
    assert {
        "key": "Cache-Control",
        "value": "no-cache, must-revalidate",
    } in global_headers


def test_google_login_supports_redirect_fallback_without_forced_reload() -> None:
    source = _read("login.html")
    firebase = _read("js/firebase-config.js")
    cache_boot = _read("js/sw-register.js")
    version_helper = _read("js/app-version.js")

    assert 'authDomain: "program-tool.firebaseapp.com"' in firebase
    assert "firebase.auth.Auth.Persistence.LOCAL" in firebase
    assert "window.authPersistenceReady" in firebase
    assert "routeAfterLogin" in firebase
    assert "DocumentReference?.prototype" not in firebase
    assert "DocumentSnapshot?.prototype" not in firebase

    assert "auth.signInWithPopup(googleProvider)" in source
    assert "auth.signInWithRedirect(googleProvider)" in source
    assert "auth.getRedirectResult()" in source
    assert "auth/popup-blocked" in source
    assert "auth/operation-not-supported-in-this-environment" in source
    assert "window.ProgramAccess.routeAfterLogin" in source
    assert "console.error(`[auth] ${context} failed`" in source

    assert "cleanupLegacyRuntime" in cache_boot
    assert "location.reload()" not in cache_boot
    assert "location.replace(" not in cache_boot
    assert "program-studio-version-changed" in version_helper
    assert "location.replace(" not in version_helper
    assert "caches.delete" not in version_helper


def test_deploy_html_transform_is_checked_by_quality_gate() -> None:
    workflow = _read(".github/workflows/quality-gate.yml")
    transform = workflow.index("python scripts/inject_boot_guard.py")
    js_check = workflow.index("find js -type f -name '*.js'")
    inline_check = workflow.index("python scripts/check_inline_js.py")
    assert transform < js_check < inline_check


def test_guide_uses_shared_safe_business_renderer() -> None:
    source = _read("guide.html")
    assert 'src="js/business-info-loader.js"' in source
    assert "ProgramBusinessInfo.render(" in source
    assert "bizText').innerHTML" not in source


def test_program_registry_does_not_render_firestore_html() -> None:
    source = _read("js/program-registry.js")
    assert ".innerHTML" not in source
    assert "textContent" in source
    assert "safeUrl" in source


def test_obsolete_generated_editor_workflow_is_removed() -> None:
    assert not (ROOT / "scripts" / "apply_editor_improvements.py").exists()
    assert not (
        ROOT / ".github" / "workflows" / "apply-editor-improvements.yml"
    ).exists()


def test_large_output_and_cleanup_contract_is_present() -> None:
    router = _read("backend/routers/pdf.py")
    main = _read("backend/main.py")
    rules = _read("storage.rules")
    assert "MAX_DIRECT_TOTAL_PDF_BYTES = 20 * 1024 * 1024" in router
    assert "upload_pdf_result" in router
    assert (
        "finally:\n"
        "        _cleanup_storage_paths(bucket, storage_paths)\n"
        "        _cleanup_local_directory(temp_dir)"
    ) in router
    assert "cleanup_temporary_pdfs" in main
    assert "match /pdf_results/{userId}/{resultId}/{fileName}" in rules
    assert (ROOT / "storage-lifecycle.json").exists()


def test_large_preflight_files_do_not_enable_direct_security_tools() -> None:
    source = _read("pdf-preflight/index.html")
    assert 'id="encryptBtn"' in source
    assert 'id="decryptBtn"' in source
    assert "selectedFile.size>20*1024*1024" in source
    assert "암호 설정·해제는 20MB 이하 PDF만 지원합니다."


def test_partial_page_repair_and_compression_fail_closed() -> None:
    repair = _read("backend/services/preflight_repair.py")
    preflight = _read("backend/routers/preflight.py")
    assert "PDF_REPAIR_INCOMPLETE" in repair
    assert "PDF_COMPRESS_INCOMPLETE" in preflight
