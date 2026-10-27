from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATH = ROOT / "scripts" / "configure_pdf_storage_cors.py"
SPEC = spec_from_file_location("configure_pdf_storage_cors", PATH)
MODULE = module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_cors_is_scoped_and_preserves_other_app_rules():
    existing = [{"origin": ["https://other.example"], "method": ["GET", "HEAD"], "maxAgeSeconds": 900}]
    result, changed = MODULE.extend_cors(existing)
    assert changed
    assert result[0] == existing[0]
    for origin in MODULE.ALLOWED_ORIGINS:
        assert any(origin in row["origin"] and "GET" in row["method"] for row in result)
    result2, changed2 = MODULE.extend_cors(result)
    assert not changed2
    assert result2 == result


def test_wildcard_existing_rule_needs_no_duplicate():
    existing = [{"origin": ["*"], "method": ["GET"], "maxAgeSeconds": 600}]
    assert MODULE.extend_cors(existing) == (existing, False)
