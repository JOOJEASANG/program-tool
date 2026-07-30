from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_home_uses_canonical_program_routes_without_obsolete_runtime_mutators():
    home = read("index.html")
    register = read("js/sw-register.js")
    assert "url:'pdf-editor/'" in home
    assert "url:'pdf-preflight/'" in home
    assert "url:'perfect-binding-cover/'" in home
    for name in ("home-cleanup.js", "program-paths.js", "site-wording-cleanup.js"):
        assert name not in register
        assert not (ROOT / "js" / name).exists()


def test_obsolete_compatibility_helpers_are_removed():
    for path in (
        "js/pdf-editor-helper.js",
        "js/pdf-editor-cleanup.js",
        "js/cover-editor-text-zones.js",
        "js/preflight/labels.js",
        "js/pdf-editor/storage-cleanup.js",
        "js/pdf-editor/history-policy.js",
    ):
        assert not (ROOT / path).exists()


def test_branding_is_consistent_on_current_public_pages():
    for path in (
        "index.html", "login.html", "admin.html", "guide.html",
        "pdf-editor/index.html", "pdf-preflight/index.html",
        "perfect-binding-cover/index.html",
    ):
        text = read(path)
        assert "Program Tool ·" not in text
    assert "<h1>Program Studio</h1>" in read("login.html")


def test_pdf_editor_has_no_dead_cloud_file_library_or_eval():
    editor = read("pdf-editor/index.html")
    legacy = read("tools/pdf-editor.html")
    assert editor == legacy
    for token in ("navHistoryBtn", "fileHistoryModal", "pdf_history", "openFileHistory", "saveToStorage", "내 파일함"):
        assert token not in editor
    assert "eval(" not in editor
    assert "PDF 저장 완료!" in editor


def test_upload_surfaces_are_keyboard_accessible():
    editor = read("pdf-editor/index.html")
    preflight = read("pdf-preflight/index.html")
    assert 'id="uploadZone" role="button" tabindex="0"' in editor
    assert "e.key === 'Enter' || e.key === ' '" in editor
    assert 'id="uploadZone" role="button" tabindex="0"' in preflight
    assert "event.key==='Enter'||event.key===' '" in preflight


def test_pdf_editor_stable_loader_is_small_and_polling_is_bounded():
    loader = read("js/pdf-editor/loader.js")
    assert "__pdfEditorModuleLoaderV15" in loader
    assert loader.count("'/js/pdf-editor/") == 8
    assert "storage-cleanup.js" not in loader
    assert "history-policy.js" not in loader
    assert "setInterval(" not in read("js/pdf-editor/preview-row-default.js")
    editor = read("pdf-editor/index.html")
    assert "new MutationObserver(requestPreviewCheck)" in editor
    assert "setInterval(async () =>" not in editor


def test_pdf_editor_mobile_layout_releases_fixed_desktop_height():
    editor = read("pdf-editor/index.html")
    assert "body { overflow: auto; }" in editor
    assert ".app { display: block; height: auto;" in editor
    assert "main { height: auto; min-height:" in editor
    assert ".preview-zoom { width: 100%;" in editor

def test_home_and_admin_mobile_layout_remain_readable():
    home = read("index.html")
    assert ".programs-head{display:block}" in home
    assert ".programs h2{word-break:keep-all}" in home
    admin = read("admin.html")
    assert "grid-template-columns:auto repeat(4,minmax(0,1fr))" in admin
    assert ".sidefoot{display:contents}" in admin

