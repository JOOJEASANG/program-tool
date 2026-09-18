from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_retired_runtime_surfaces_stay_removed():
    retired = (
        "design-editor/index.html",
        "design-editor/general.html",
        "document-editor/index.html",
        "image-editor/index.html",
        "js/design-editor/core-runtime.js",
        "js/design-editor/shell-runtime.js",
        "js/design-editor/app.js",
        "js/design-editor/output.js",
        "js/print-checker/simple-editor.js",
        "css/print-checker-simple-editor.css",
        "js/program-registry.js",
        "js/cover-jspdf-loader.js",
        "reset-cache.html",
        "booklet/index.html",
    )
    for relative in retired:
        assert not (ROOT / relative).exists(), relative


def test_modular_shell_owns_only_pdf_apps():
    apps_html = read("apps/index.html")
    shell = read("js/studio-app-shell.js")
    access = read("js/modular-app-access.js")

    assert "/print-checker?product=" in apps_html
    assert "design-editor/general" not in apps_html

    for marker in (
        "design-editor",
        "DesignEditor",
        "DESIGN_PRELOADS",
        "warmDesignAssets",
        "design-studio",
    ):
        assert marker not in shell
        assert marker not in access

    assert "'pdf-layout'" in shell
    assert "booklet" in shell
    assert "/pdf-editor/?embed=1&app=layout" in shell
    assert "/pdf-editor/?embed=1&app=booklet" in shell
    assert "['pdf-layout','booklet']" in access


def test_retired_cover_entrypoint_redirects_without_old_pdf_runtime():
    html = read("perfect-binding-cover/index.html")

    assert "location.replace('/print-checker?product=cover')" in html
    assert 'http-equiv="refresh"' in html
    assert not (ROOT / "js" / "cover-jspdf-loader.js").exists()
    assert not (ROOT / "js" / "design-editor" / "output.js").exists()


def test_live_pdf_preflight_helpers_remain_available():
    preflight = read("pdf-preflight/index.html")
    for relative in (
        "js/common-context-menu.js",
        "js/editor-enhancements.js",
    ):
        assert (ROOT / relative).is_file()
        assert Path(relative).name in preflight


def test_current_docs_describe_removed_design_runtime_as_retired():
    readme = read("README.md")
    structure = read("PROGRAM_STRUCTURE.md")

    assert "과거 `design-editor`, `document-editor`, `image-editor`, `simple-editor` 런타임은 운영 트리에서 제거" in readme
    assert "`design-editor`, `document-editor`, `image-editor`, `simple-editor` 런타임은 운영 트리에 존재하지 않습니다." in structure
    assert "Node.js 24" in readme
    assert "firebase-tools@15.28.1" in readme
