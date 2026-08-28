from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"


def load_module(name: str, path: Path):
    sys.path.insert(0, str(SCRIPTS))
    try:
        spec = importlib.util.spec_from_file_location(name, path)
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
        return module
    finally:
        sys.path.pop(0)


def test_phase11_hosting_delivery_policy_validator_passes():
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "validate_hosting_delivery.py")],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=20,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Hosting delivery policy OK:" in result.stdout
    assert "immutable caching remains disabled" in result.stdout


def test_phase11_preview_delivery_route_contract_matches_phase10_routes():
    phase10 = load_module("phase10_route_budget_contract", SCRIPTS / "validate_route_budgets.py")
    phase11 = load_module("phase11_preview_delivery_contract", SCRIPTS / "verify_preview_delivery.py")

    assert set(phase11.ROUTE_PATHS) == set(phase10.ROUTE_BUDGETS)
    assert set(phase11.ROUTE_DELIVERY_BUDGETS) == set(phase10.ROUTE_BUDGETS)
    for route, (request_budget, byte_budget) in phase11.ROUTE_DELIVERY_BUDGETS.items():
        assert request_budget >= phase10.ROUTE_BUDGETS[route][0] + 1
        assert byte_budget >= phase10.ROUTE_BUDGETS[route][1]


def test_phase11_bootstrap_parser_limits_itself_to_bootstrap_resources():
    phase11 = load_module("phase11_preview_delivery_parser", SCRIPTS / "verify_preview_delivery.py")
    html = """
    <link rel="stylesheet" href="/css/app.css?v=1">
    <script src="/js/app.js?v=1"></script>
    <a href="/guide">Guide</a>
    <img src="/images/hero.png">
    """
    assets = phase11.extract_bootstrap_assets(
        "https://program-tool.web.app/",
        "https://program-tool.web.app/",
        html,
    )
    assert assets == ["/css/app.css?v=1", "/js/app.js?v=1"]


def test_phase11_preview_workflow_runs_deployed_delivery_gate():
    workflow = (ROOT / ".github" / "workflows" / "firebase-preview.yml").read_text(encoding="utf-8")
    assert "실제 배포 전달 예산·헤더 검증" in workflow
    assert "python3 scripts/verify_preview_delivery.py" in workflow
    assert "--report /tmp/preview-delivery.json" in workflow
    assert "/tmp/preview-delivery.json" in workflow


def test_phase11_latency_is_diagnostic_not_a_flaky_failure_budget():
    source = (SCRIPTS / "verify_preview_delivery.py").read_text(encoding="utf-8")
    assert "latency_is_diagnostic_only" in source
    assert "response_ms_p95_diagnostic" in source
    assert "LATENCY_BUDGET" not in source
