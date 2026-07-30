"""Pytest policy for the intentionally stable eight-module PDF editor runtime.

The tests skipped here target helper modules added after July 20. Those extra
wrappers remain deliberately disabled because loading all of them together caused
the browser hang. Selected July 24 core improvements may be ported inside the
same eight-module runtime without re-enabling those post-July20 wrapper tests.
Server, permission, export, Firebase, and stable-runtime tests remain enabled.
"""

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
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
    "tests/test_repository_hardening.py::test_frontend_and_rules_use_hardened_contract",
}


def _is_stable_eight_module_runtime() -> bool:
    try:
        loader = LOADER_FILE.read_text(encoding="utf-8")
    except OSError:
        return False
    return (
        loader.count("'/js/pdf-editor/") == 8
        and (
            "__pdfEditorModuleLoaderV13" in loader
            or "__pdfEditorModuleLoaderV14" in loader
            or "__pdfEditorModuleLoaderV15" in loader
        )
        and "preview-controller.js" not in loader
        and "runtime-integrity.js" not in loader
        and "ux-repair.js" not in loader
        and "dock-width-align.js" not in loader
    )


def pytest_collection_modifyitems(items):
    if not _is_stable_eight_module_runtime():
        return

    reason = (
        "PDF editor intentionally uses the stable eight-module runtime; "
        "this test requires a later helper wrapper that remains disabled."
    )
    marker = pytest.mark.skip(reason=reason)

    for item in items:
        normalized = item.nodeid.replace("\\", "/")
        file_node = normalized.split("::", 1)[0]
        if file_node in POST_JULY20_TEST_FILES or normalized in POST_JULY20_TEST_CASES:
            item.add_marker(marker)
