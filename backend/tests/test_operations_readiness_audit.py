import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "check_operations_readiness.py"


def _load_auditor():
    spec = importlib.util.spec_from_file_location("operations_readiness", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _status(report, name: str) -> str:
    return next(item["status"] for item in report["checks"] if item["name"] == name)


def test_operations_readiness_requires_wif_even_if_legacy_token_exists(monkeypatch):
    auditor = _load_auditor()
    monkeypatch.setenv("MAIN_PROTECTED", "false")
    monkeypatch.delenv("GCP_WORKLOAD_IDENTITY_PROVIDER", raising=False)
    monkeypatch.delenv("GCP_SERVICE_ACCOUNT", raising=False)
    monkeypatch.setenv("FIREBASE_TOKEN", "redacted-test-token")

    report, exit_code = auditor.audit()

    assert exit_code == 1
    assert report["overall"] == "FAIL"
    assert report["secrets_redacted"] is True
    assert _status(report, "storage_lifecycle_contract") == "PASS"
    assert _status(report, "admin_claim_migration_tool") == "PASS"
    assert _status(report, "wif_repository_contract") == "PASS"
    assert _status(report, "pdf_runtime_capacity_contract") == "PASS"
    assert _status(report, "github_main_protection") == "WARN"
    assert _status(report, "wif_secret_pair") == "FAIL"
    assert _status(report, "firebase_ci_authentication") == "FAIL"


def test_operations_readiness_fails_partial_wif_configuration(monkeypatch):
    auditor = _load_auditor()
    monkeypatch.setenv("MAIN_PROTECTED", "true")
    monkeypatch.setenv(
        "GCP_WORKLOAD_IDENTITY_PROVIDER",
        "projects/123/locations/global/workloadIdentityPools/test/providers/github",
    )
    monkeypatch.delenv("GCP_SERVICE_ACCOUNT", raising=False)
    monkeypatch.setenv("FIREBASE_TOKEN", "redacted-test-token")

    report, exit_code = auditor.audit()

    assert exit_code == 1
    assert report["overall"] == "FAIL"
    assert _status(report, "wif_secret_pair") == "FAIL"
    assert _status(report, "firebase_ci_authentication") == "FAIL"


def test_operations_readiness_workflow_checks_external_state_without_printing_secrets():
    workflow = (ROOT / ".github" / "workflows" / "operations-readiness.yml").read_text(
        encoding="utf-8"
    )

    assert "workflow_dispatch:" in workflow
    assert "main 보호 상태 조회" in workflow
    assert "scripts/check_operations_readiness.py" in workflow
    assert "GCP_WORKLOAD_IDENTITY_PROVIDER" in workflow
    assert "GCP_SERVICE_ACCOUNT" in workflow
    assert "FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}" not in workflow
    assert "Google Cloud WIF 실제 인증 확인" in workflow
    assert "operations-readiness-report" in workflow
