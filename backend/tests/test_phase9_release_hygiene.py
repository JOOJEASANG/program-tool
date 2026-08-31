from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def load_inject_module():
    path = ROOT / "scripts" / "inject_boot_guard.py"
    spec = spec_from_file_location("program_studio_inject_boot_guard", path)
    assert spec and spec.loader
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_phase9_favicon_asset_and_deploy_inventory():
    inject = load_inject_module()
    favicon = ROOT / "favicon.svg"
    assert favicon.is_file()
    assert '<svg xmlns="http://www.w3.org/2000/svg"' in favicon.read_text(encoding="utf-8")
    assert len(inject.DEPLOY_HTML) == 16
    assert "index.html" in inject.DEPLOY_HTML
    assert "pdf-editor/index.html" in inject.DEPLOY_HTML
    assert "pdf-preflight/index.html" in inject.DEPLOY_HTML
    assert "tools/pdf-editor.html" in inject.DEPLOY_HTML
    assert "tools/preflight.html" not in inject.DEPLOY_HTML
    assert "tools/pdf-Checker.html" not in inject.DEPLOY_HTML


def test_phase9_injection_adds_one_common_favicon():
    inject = load_inject_module()
    source = "<!doctype html><html><head><title>x</title></head><body></body></html>"
    updated = inject.inject_guard(source, "test", favicon=True)
    assert updated.count(inject.FAVICON_MARKER) == 1
    assert 'rel="icon" href="/favicon.svg" type="image/svg+xml"' in updated
    repeated = inject.inject_guard(updated, "test", favicon=True)
    assert repeated == updated


def test_phase9_quality_gate_validates_release_hygiene():
    workflow = (ROOT / ".github" / "workflows" / "quality-gate.yml").read_text(encoding="utf-8")
    assert "Validate release hygiene" in workflow
    assert "python scripts/validate_release_hygiene.py" in workflow
