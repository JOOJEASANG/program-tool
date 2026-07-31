from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
TOOL = ROOT / "tools" / "pdf-editor.html"
ROUTE = ROOT / "pdf-editor" / "index.html"
JULY20_BASELINE_COMMIT = "7a6fa3d1bbad1dcfa8e2acd62cf12057532d5b66"
JULY24_CORE_COMMIT = "44e88dfd8b7da63dea6dff114a96942727b815c9"

STABLE_MODULES = [
    "/js/pdf-editor/font-render-fix.js",
    "/js/pdf-editor/upload-fix.js",
    "/js/pdf-editor/live-preview.js",
    "/js/pdf-editor/layout-export.js",
    "/js/pdf-editor/page-count-hint.js",
    "/js/pdf-editor/nup-helper.js",
    "/js/pdf-editor/preview-row-default.js",
    "/js/pdf-editor/divider-helper.js",
]


def test_loader_keeps_the_eight_module_stable_runtime():
    text = LOADER.read_text(encoding="utf-8")
    assert JULY20_BASELINE_COMMIT and JULY24_CORE_COMMIT
    assert "__pdfEditorModuleLoaderV18" in text
    for module in STABLE_MODULES:
        assert module in text
    assert text.count("'/js/pdf-editor/") == len(STABLE_MODULES)
    for forbidden in (
        "preview-controller.js",
        "runtime-integrity.js",
        "ux-repair.js",
        "dock-width-align.js",
        "thumbnail-integrity.js",
    ):
        assert forbidden not in text


def test_both_public_entrypoints_use_the_same_restored_editor():
    assert TOOL.read_bytes() == ROUTE.read_bytes()
