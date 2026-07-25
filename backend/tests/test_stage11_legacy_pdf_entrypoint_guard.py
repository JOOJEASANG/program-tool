import ast
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
LEGACY_MODULE = BACKEND_ROOT / "services" / "pdf_ops.py"


def _production_python_files():
    for path in BACKEND_ROOT.rglob("*.py"):
        if path == LEGACY_MODULE or "tests" in path.parts or "__pycache__" in path.parts:
            continue
        yield path


def test_production_code_does_not_use_legacy_process_pdf_entrypoint():
    violations = []

    for path in _production_python_files():
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        legacy_module_aliases = set()
        legacy_function_aliases = set()

        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                module = node.module or ""
                if module in {"services.pdf_ops", "backend.services.pdf_ops"}:
                    for name in node.names:
                        if name.name == "process_pdf":
                            legacy_function_aliases.add(name.asname or name.name)
            elif isinstance(node, ast.Import):
                for name in node.names:
                    if name.name in {"services.pdf_ops", "backend.services.pdf_ops"}:
                        legacy_module_aliases.add(name.asname or name.name.split(".")[-1])

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            if isinstance(node.func, ast.Name) and node.func.id in legacy_function_aliases:
                violations.append(f"{path.relative_to(BACKEND_ROOT)}:{node.lineno}")
            elif (
                isinstance(node.func, ast.Attribute)
                and node.func.attr == "process_pdf"
                and isinstance(node.func.value, ast.Name)
                and node.func.value.id in legacy_module_aliases
            ):
                violations.append(f"{path.relative_to(BACKEND_ROOT)}:{node.lineno}")

    assert not violations, (
        "운영 코드는 구형 services.pdf_ops.process_pdf()를 호출하면 안 됩니다. "
        "services.pdf_engine.process_pdf_bytes() 또는 process_pdf_paths()를 사용하세요: "
        + ", ".join(violations)
    )
