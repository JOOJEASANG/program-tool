import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "check_cloud_external_state.py"


def _load():
    spec = importlib.util.spec_from_file_location("cloud_external_state", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_cloud_state_lifecycle_requires_all_three_one_day_prefixes():
    module = _load()
    payload = {
        "lifecycle": {
            "rule": [
                {
                    "action": {"type": "Delete"},
                    "condition": {
                        "age": 1,
                        "matchesPrefix": [
                            "pdf_temp/",
                            "preflight_temp/",
                            "pdf_results/",
                        ],
                    },
                }
            ]
        }
    }

    ok, detail = module.evaluate_lifecycle_payload(payload)

    assert ok is True
    assert "all required" in detail


def test_cloud_state_lifecycle_reports_missing_prefix_without_mutation():
    module = _load()
    payload = {
        "lifecycle": {
            "rule": [
                {
                    "action": {"type": "Delete"},
                    "condition": {"age": 1, "matchesPrefix": ["pdf_temp/"]},
                }
            ]
        }
    }

    ok, detail = module.evaluate_lifecycle_payload(payload)

    assert ok is False
    assert "preflight_temp/" in detail
    assert "pdf_results/" in detail

    source = SCRIPT.read_text(encoding="utf-8")
    assert "set_custom_user_claims" not in source
    assert "blob.delete(" not in source
    assert "bucket.patch(" not in source


def test_operations_readiness_workflow_runs_cloud_readback_only_after_wif():
    workflow = (ROOT / ".github" / "workflows" / "operations-readiness.yml").read_text(
        encoding="utf-8"
    )

    assert "Google Cloud WIF 실제 인증 확인" in workflow
    assert "Cloud 상태 읽기 의존성 설치" in workflow
    assert "실제 Storage lifecycle · 관리자 Claim 읽기 검증" in workflow
    assert "scripts/check_cloud_external_state.py" in workflow
    assert "continue-on-error: true" in workflow
    assert "/tmp/cloud-external-state.json" in workflow
