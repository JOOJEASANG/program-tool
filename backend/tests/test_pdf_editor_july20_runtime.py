import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
REGISTER = ROOT / "js" / "sw-register.js"
DIVIDER_HELPER = ROOT / "js" / "pdf-editor" / "divider-helper.js"
TOOL = ROOT / "tools" / "pdf-editor.html"
ROUTE = ROOT / "pdf-editor" / "index.html"
JULY20_BASELINE_COMMIT = "7a6fa3d1bbad1dcfa8e2acd62cf12057532d5b66"
JULY24_CORE_COMMIT = "44e88dfd8b7da63dea6dff114a96942727b815c9"

STABLE_ROOT_MODULES = [
    "/js/pdf-editor/font-render-fix.js",
    "/js/pdf-editor/upload-fix.js",
    "/js/pdf-editor/live-preview.js",
    "/js/pdf-editor/layout-export.js",
    "/js/pdf-editor/page-count-hint.js",
    "/js/pdf-editor/nup-helper.js",
    "/js/pdf-editor/preview-row-default.js",
    "/js/pdf-editor/divider-helper.js",
]

STANDALONE_EDITOR_SCRIPTS = [
    "/js/pdf-editor/crop-marks.js",
]

OWNED_TRANSITIVE_SCRIPTS = {
    "/js/pdf-editor/divider-helper.js": "/js/pdf-editor/divider-studio.js",
}

DISABLED_ROOT_WRAPPERS = [
    "/js/pdf-editor/booklet-print-guide.js",
    "/js/pdf-editor/dock-width-align.js",
    "/js/pdf-editor/operation-progress-summary.js",
    "/js/pdf-editor/output-contract.js",
    "/js/pdf-editor/preview-controller.js",
    "/js/pdf-editor/print-marks-bleed.js",
    "/js/pdf-editor/runtime-integrity.js",
    "/js/pdf-editor/thumbnail-integrity.js",
    "/js/pdf-editor/ux-repair.js",
]


def _root_modules(source: str) -> list[str]:
    match = re.search(r"const\s+MODULES\s*=\s*\[(.*?)\];", source, re.DOTALL)
    assert match, "PDF root module array is missing"
    return [
        value.split("?", 1)[0]
        for value in re.findall(r"['\"]([^'\"]+\.js(?:\?[^'\"]*)?)['\"]", match.group(1))
    ]


def test_loader_keeps_the_exact_eight_module_stable_runtime():
    text = LOADER.read_text(encoding="utf-8")
    assert JULY20_BASELINE_COMMIT and JULY24_CORE_COMMIT
    assert re.search(r"__pdfEditorModuleLoaderV\d+", text)
    assert _root_modules(text) == STABLE_ROOT_MODULES
    assert len(set(STABLE_ROOT_MODULES)) == len(STABLE_ROOT_MODULES)


def test_editor_standalone_and_transitive_scripts_have_one_owner():
    register = REGISTER.read_text(encoding="utf-8")
    divider = DIVIDER_HELPER.read_text(encoding="utf-8")

    for script in STANDALONE_EDITOR_SCRIPTS:
        assert register.count(script) == 1
        assert script not in LOADER.read_text(encoding="utf-8")

    for owner, script in OWNED_TRANSITIVE_SCRIPTS.items():
        assert owner in STABLE_ROOT_MODULES
        assert divider.count(script) == 1
        assert script not in LOADER.read_text(encoding="utf-8")
        assert script not in register


def test_disabled_wrapper_files_are_not_runtime_roots():
    runtime_sources = "\n".join(
        (
            LOADER.read_text(encoding="utf-8"),
            REGISTER.read_text(encoding="utf-8"),
        )
    )
    for wrapper in DISABLED_ROOT_WRAPPERS:
        assert wrapper not in runtime_sources


def test_legacy_public_entrypoint_redirects_to_the_restored_editor():
    legacy = TOOL.read_text(encoding="utf-8")
    assert ROUTE.read_text(encoding="utf-8") != legacy
    assert 'http-equiv="refresh"' in legacy
    assert "/pdf-editor/" in legacy
    assert "location.replace" in legacy
    assert "location.search+location.hash" in legacy
