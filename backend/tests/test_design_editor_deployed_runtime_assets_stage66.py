from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SMOKE = ROOT / "scripts" / "smoke_deployment.py"
PREVIEW = ROOT / ".github" / "workflows" / "firebase-preview.yml"
PRODUCTION = ROOT / ".github" / "workflows" / "firebase-deploy.yml"


def test_stage66_deployment_smoke_reads_runtime_assets_from_single_manifest_source():
    source = SMOKE.read_text(encoding="utf-8")
    assert "js\" / \"sw-register.js" in source
    assert "RUNTIME_MANIFEST_PATTERN" in source
    assert "RUNTIME_ENTRY_PATTERN" in source
    assert "def design_editor_runtime_assets()" in source
    assert "len(ids) != len(set(ids))" in source
    assert "len(paths) != len(set(paths))" in source


def test_stage66_deployment_smoke_fetches_every_runtime_asset_as_javascript():
    source = SMOKE.read_text(encoding="utf-8")
    assert "def _require_javascript_asset" in source
    assert 'if "javascript" not in content_type' in source
    assert 'startswith(("<!doctype html", "<html"))' in source
    assert "def _require_design_editor_runtime_assets" in source
    assert "for script_id, path in entries" in source
    assert "_require_javascript_asset(_fetch(base_url, path, timeout))" in source
    assert '"디자인 편집기 런타임 자산"' in source


def test_stage66_same_smoke_script_guards_preview_and_production_deployments():
    preview = PREVIEW.read_text(encoding="utf-8")
    production = PRODUCTION.read_text(encoding="utf-8")
    assert "python3 scripts/smoke_deployment.py" in preview
    assert "python3 scripts/smoke_deployment.py" in production
