"""Pytest policy for the intentionally stable eight-module PDF editor runtime.

The skipped tests below target obsolete root wrappers that are intentionally not
loaded. Restored features must be tested through their current owner module, not
by re-enabling the old wrapper. Server, permission, export, Firebase, and current
restored-feature tests remain enabled.
"""

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
LOADER_FILE = ROOT / "js" / "pdf-editor" / "loader.js"

DISABLED_WRAPPER_TEST_FILES = {
    "tests/test_pdf_booklet_frontend.py": "booklet-print-guide.js",
    "tests/test_pdf_editor_preview_single_flight.py": "preview-controller.js",
    "tests/test_pdf_editor_ux_repair.py": "ux-repair.js",
    "tests/test_pdf_full_integrity_audit.py": "runtime-integrity.js",
    "tests/test_pdf_operation_progress_summary.py": "operation-progress-summary.js",
    "tests/test_pdf_preview_toolbar_dock_final.py": "dock-width-align.js",
    "tests/test_pdf_print_marks_frontend.py": "print-marks-bleed.js",
}

DISABLED_WRAPPER_TEST_CASES = {
    "tests/test_repository_hardening.py::test_frontend_and_rules_use_hardened_contract": "output-contract.js",
}

DISABLED_RUNTIME_ROOTS = {
    "booklet-print-guide.js",
    "dock-width-align.js",
    "operation-progress-summary.js",
    "output-contract.js",
    "preview-controller.js",
    "print-marks-bleed.js",
    "runtime-integrity.js",
    "ux-repair.js",
}


def _is_stable_eight_module_runtime() -> bool:
    try:
        loader = LOADER_FILE.read_text(encoding="utf-8")
    except OSError:
        return False
    return (
        loader.count("'/js/pdf-editor/") == 8
        and re.search(r"__pdfEditorModuleLoaderV\d+", loader) is not None
        and all(module not in loader for module in DISABLED_RUNTIME_ROOTS)
    )


def pytest_collection_modifyitems(items):
    if not _is_stable_eight_module_runtime():
        return

    for item in items:
        normalized = item.nodeid.replace("\\", "/")
        file_node = normalized.split("::", 1)[0]
        required_wrapper = DISABLED_WRAPPER_TEST_FILES.get(file_node)
        if required_wrapper is None:
            required_wrapper = DISABLED_WRAPPER_TEST_CASES.get(normalized)
        if required_wrapper is None:
            continue

        item.add_marker(
            pytest.mark.skip(
                reason=(
                    "PDF editor uses the stable eight-module runtime; "
                    f"this legacy test requires disabled root wrapper {required_wrapper}."
                )
            )
        )
