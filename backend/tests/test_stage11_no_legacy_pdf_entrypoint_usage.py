from pathlib import Path
import re


BACKEND_ROOT = Path(__file__).resolve().parents[1]
LEGACY_MODULE = BACKEND_ROOT / "services" / "pdf_ops.py"


def _production_python_files():
    for path in BACKEND_ROOT.rglob("*.py"):
        if path == LEGACY_MODULE:
            continue
        if "tests" in path.parts or "__pycache__" in path.parts:
            continue
        yield path


def test_production_code_does_not_call_legacy_process_pdf_entrypoint():
    violations = []
    direct_import = re.compile(
        r"from\s+services\.pdf_ops\s+import\s+[^\n]*\bprocess_pdf\b"
    )
    qualified_call = re.compile(r"\bpdf_ops\.process_pdf\s*\(")

    for path in _production_python_files():
        source = path.read_text(encoding="utf-8")
        if direct_import.search(source) or qualified_call.search(source):
            violations.append(str(path.relative_to(BACKEND_ROOT)))

    assert not violations, (
        "구형 services.pdf_ops.process_pdf() 호출이 다시 추가되었습니다. "
        "services.pdf_engine.process_pdf_bytes() 또는 process_pdf_paths()를 사용하세요: "
        + ", ".join(violations)
    )
