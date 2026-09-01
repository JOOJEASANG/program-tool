from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


REMOVED_PATHS = [
    ".github/workflows/backup-before-unified-print.yml",
    "js/design-editor/essential-workspace.js",
    "js/design-editor/workflow-v2.js",
    "js/design-editor/preview-guide-enhancement.js",
    "js/design-editor/print-production-stage2.js",
    "js/design-editor/cover-preview-cleanup.js",
    "js/design-editor/shape-inspector-ux.js",
    "js/design-editor/shape-border-controls.js",
    "js/design-editor/text-auto-fit.js",
    "js/design-editor/typography-pro.js",
]


def test_removed_legacy_files_stay_removed():
    for relative_path in REMOVED_PATHS:
        assert not (ROOT / relative_path).exists(), relative_path


def test_active_design_runtime_does_not_reference_removed_files():
    runtime_files = [
        ROOT / "js/design-editor/core-runtime.js",
        ROOT / "js/design-editor/shell-runtime.js",
        ROOT / "design-editor/general.html",
        ROOT / "design-editor/index.html",
    ]
    active_source = "\n".join(path.read_text(encoding="utf-8") for path in runtime_files)
    for relative_path in REMOVED_PATHS:
        filename = Path(relative_path).name
        assert filename not in active_source, filename
