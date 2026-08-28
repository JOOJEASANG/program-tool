from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]


def test_phase8_runtime_asset_validator_passes():
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "validate_runtime_assets.py")],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=20,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Runtime assets OK:" in result.stdout
    assert "home helpers 10/10" in result.stdout


def test_phase8_quality_gate_contract():
    workflow = (ROOT / ".github" / "workflows" / "quality-gate.yml").read_text(encoding="utf-8")
    assert "Validate runtime asset manifest" in workflow
    assert "python scripts/validate_runtime_assets.py" in workflow
    assert "Run Phase 8 runtime asset smoke" in workflow
    assert "bash scripts/run_phase8_browser_smoke.sh" in workflow


def test_retired_service_worker_is_not_registered_again():
    runtime = (ROOT / "js" / "sw-register.js").read_text(encoding="utf-8")
    assert "navigator.serviceWorker.register" not in runtime
    assert "serviceWorker.register(" not in runtime
    assert (ROOT / "sw.js").is_file()


def test_retired_home_experiment_assets_stay_removed():
    active_sources = [
        ROOT / "index.html",
        ROOT / "js" / "firebase-config.js",
        ROOT / "js" / "program-studio-ui-v2.js",
        ROOT / "js" / "sw-register.js",
    ]
    active_text = "\n".join(path.read_text(encoding="utf-8") for path in active_sources)
    for name in ("home-premium-ui.js", "home-hero-console-v2.js"):
        assert not (ROOT / "js" / name).exists()
        assert name not in active_text
