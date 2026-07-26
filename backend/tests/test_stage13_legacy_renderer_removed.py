import ast
from pathlib import Path


def test_pdf_ops_no_longer_defines_legacy_process_pdf():
    source = Path("services/pdf_ops.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    names = {node.name for node in tree.body if isinstance(node, ast.FunctionDef)}
    assert "process_pdf" not in names


def test_services_package_does_not_install_compatibility_entrypoint():
    from services import pdf_ops

    assert not hasattr(pdf_ops, "process_pdf")
    source = Path("services/__init__.py").read_text(encoding="utf-8")
    assert "install_common_engine_entrypoint" not in source
