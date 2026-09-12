from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_modular_shell_contains_only_live_pdf_apps():
    shell = read("js/studio-app-shell.js")
    apps = read("apps/index.html")

    assert "'/pdf-editor/?embed=1&app=layout'" in shell
    assert "'/pdf-editor/?embed=1&app=booklet'" in shell
    assert "design-editor" not in shell
    assert "DesignEditor" not in shell
    assert "DESIGN_PRELOADS" not in shell
    assert "warmDesignAssets" not in shell
    assert "openQuickAction" not in shell

    # Old design URLs remain only as compatibility redirects to Print Checker.
    assert "location.replace('/print-checker?product='+product)" in apps
    assert "design-editor" not in apps


def test_removed_design_runtime_directory_does_not_return():
    assert not (ROOT / "js" / "design-editor").exists()
    assert not (ROOT / "design-editor").exists()


def test_removed_orphan_frontend_helpers_do_not_return():
    for path in (
        "js/program-registry.js",
        "js/cover-jspdf-loader.js",
    ):
        assert not (ROOT / path).exists()


def test_live_pdf_preflight_helpers_remain_available():
    preflight = read("pdf-preflight/index.html")
    for path in (
        "js/common-context-menu.js",
        "js/editor-enhancements.js",
    ):
        assert (ROOT / path).is_file()
        assert Path(path).name in preflight
