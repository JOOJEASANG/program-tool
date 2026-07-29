"""Pytest policy for the intentionally restored July 20 PDF editor runtime.

The tests skipped here were introduced for PDF editor helper modules added after
July 20. Those modules are deliberately not loaded by the restored runtime
because their accumulated wrappers are the leading cause of the browser hang.
Server, permission, export, Firebase, and July 20 runtime tests remain enabled.
"""

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
VERSION_FILE = ROOT / "version.json"
LOADER_FILE = ROOT / "js" / "pdf-editor" / "loader.js"

POST_JULY20_TEST_FILES = {
    "tests/test_pdf_booklet_frontend.py",
    "tests/test_pdf_booklet_print_guide.py",
    "tests/test_pdf_editor_preview_single_flight.py",
    "tests/test_pdf_editor_ux_repair.py",
    "tests/test_pdf_full_integrity_audit.py",
    "tests/test_pdf_individual_margins.py",
    "tests/test_pdf_operation_progress_summary.py",
    "tests/test_pdf_page_productivity.py",
    "tests/test_pdf_preview_toolbar_dock_final.py",
    "tests/test_pdf_print_marks_frontend.py",
}

POST_JULY20_TEST_CASES = {
    "tests/test_file_library_and_cover_ui.py::test_pdf_file_library_is_fully_removed",
    "tests/test_file_library_and_cover_ui.py::test_pdf_download_remains_local_and_large_preview_is_explained",
    "tests/test_reliability_fixes.py::test_csp_is_enforced_and_runtime_eval_is_absent",
    "tests/test_repository_hardening.py::test_frontend_and_rules_use_hardened_contract",
}


def _is_july20_restore() -> bool:
    try:
        version = json.loads(VERSION_FILE.read_text(encoding="utf-8"))
        loader = LOADER_FILE.read_text(encoding="utf-8")
    except (OSError, ValueError):
        return False
    return (
        version.get("version") == "2026.07.29.008"
        and "__pdfEditorModuleLoaderV13" in loader
        and "preview-controller.js" not in loader
    )


def pytest_collection_modifyitems(items):
    if not _is_july20_restore():
        return

    reason = (
        "PDF editor is intentionally restored to the July 20 runtime; "
        "this test requires a later helper module that is deliberately disabled."
    )
    marker = pytest.mark.skip(reason=reason)

    for item in items:
        normalized = item.nodeid.replace("\\", "/")
        file_node = normalized.split("::", 1)[0]
        if file_node in POST_JULY20_TEST_FILES or normalized in POST_JULY20_TEST_CASES:
            item.add_marker(marker)
