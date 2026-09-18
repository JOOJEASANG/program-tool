import ast
from pathlib import Path

from services import pdf_ops


BACKEND_ROOT = Path(__file__).resolve().parents[1]
MAIN_PATH = BACKEND_ROOT / "main.py"
SERVICES_ROOT = BACKEND_ROOT / "services"
SERVICES_INIT = SERVICES_ROOT / "__init__.py"
PDF_OPS = SERVICES_ROOT / "pdf_ops.py"
PDF_ROUTER = BACKEND_ROOT / "routers" / "pdf.py"

RETIRED_LAYOUT_MODULES = (
    SERVICES_ROOT / "pdf_individual_margin_patch.py",
    SERVICES_ROOT / "pdf_layout_engine.py",
    SERVICES_ROOT / "pdf_layout_implementation.py",
)


def test_services_contains_no_runtime_patch_modules():
    patch_modules = sorted(
        path.relative_to(BACKEND_ROOT).as_posix()
        for path in SERVICES_ROOT.rglob("*_patch.py")
    )
    assert patch_modules == []


def test_retired_layout_modules_stay_removed():
    for path in RETIRED_LAYOUT_MODULES:
        assert not path.exists(), path.name


def test_pdf_ops_no_longer_exposes_legacy_process_pdf():
    source = PDF_OPS.read_text(encoding="utf-8")
    tree = ast.parse(source)
    top_level_functions = {
        node.name for node in tree.body if isinstance(node, ast.FunctionDef)
    }

    assert "process_pdf" not in top_level_functions
    assert not hasattr(pdf_ops, "process_pdf")


def test_startup_and_services_do_not_install_legacy_entrypoints():
    main = MAIN_PATH.read_text(encoding="utf-8")
    services_init = SERVICES_INIT.read_text(encoding="utf-8")

    for marker in (
        "pdf_individual_margin_patch",
        "install_common_engine_entrypoint",
    ):
        assert marker not in main

    for marker in (
        "install_common_engine_entrypoint",
        "pdf_ops.process_pdf",
        "pdf_individual_margin_patch",
        "sys.modules",
    ):
        assert marker not in services_init


def test_pdf_router_uses_explicit_canonical_engine():
    router = PDF_ROUTER.read_text(encoding="utf-8")

    assert "from services.pdf_engine import process_pdf_bytes" in router
    assert "output_bytes = process_pdf_bytes(file_bytes_list, req)" in router


def test_services_do_not_install_runtime_function_replacements():
    forbidden_markers = (
        "_patch_v",
        "sys.modules[",
        "setattr(pdf_ops",
        "pdf_ops.process_pdf =",
        "preflight_svc.run_all_checks =",
        "preflight_router._fix_pdf_response =",
    )

    findings: list[str] = []
    for path in SERVICES_ROOT.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        for marker in forbidden_markers:
            if marker in source:
                findings.append(f"{path.relative_to(BACKEND_ROOT)}: {marker}")

    assert findings == []
