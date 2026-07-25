import ast
from pathlib import Path


def test_pdf_ops_no_longer_defines_legacy_process_pdf():
    source = Path("services/pdf_ops.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    names = {node.name for node in tree.body if isinstance(node, ast.FunctionDef)}
    assert "process_pdf" not in names


def test_compatibility_entrypoint_is_installed_from_services_package():
    from services import pdf_ops

    assert pdf_ops.process_pdf.__module__ == "services"
