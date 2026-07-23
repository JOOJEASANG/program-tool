from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_pdf_repair_uses_blank_page_safe_copy_path():
    source = _read("backend/services/preflight_repair_patch.py")

    assert "output.insert_pdf(" in source
    assert "page-sizes=preserved" in source
    assert "json.dumps(payload, ensure_ascii=False)" in source


def test_inline_javascript_checker_preserves_module_mode():
    source = _read("scripts/check_inline_js.py")

    assert "self.current_is_module = script_type == \"module\"" in source
    assert "suffix = \".mjs\" if inline.is_module else \".js\"" in source
    assert "InlineScript(source=script, is_module=self.current_is_module)" in source


def test_frontend_failure_logs_are_uploaded():
    source = _read(".github/workflows/quality-gate.yml")

    assert "python scripts/check_inline_js.py 2>&1 | tee inline-js.log" in source
    assert "inline-js.log" in source
    assert "stale-workflows.log" in source
