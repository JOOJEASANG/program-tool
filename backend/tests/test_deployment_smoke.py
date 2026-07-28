from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "smoke_deployment.py"
SPEC = importlib.util.spec_from_file_location("smoke_deployment", SCRIPT)
assert SPEC and SPEC.loader
smoke = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = smoke
SPEC.loader.exec_module(smoke)


def result(
    body: str,
    *,
    headers: dict[str, str] | None = None,
    status: int = 200,
    url: str = "https://example.test/",
):
    return smoke.HttpResult(
        url=url,
        status=status,
        headers=headers or {},
        body=body.encode("utf-8"),
    )


def test_home_contract_requires_content_and_security_headers():
    response = result(
        "<title>Program Studio</title>",
        headers={
            "strict-transport-security": "max-age=31536000; includeSubDomains",
            "content-security-policy": "default-src 'self'; object-src 'none'",
            "x-content-type-options": "nosniff",
            "x-frame-options": "DENY",
        },
    )

    smoke._require_text(response, "Program Studio")
    smoke._require_security_headers(response)


def test_security_header_failure_is_actionable():
    response = result("Program Studio", headers={})

    with pytest.raises(smoke.SmokeFailure, match="보안 헤더"):
        smoke._require_security_headers(response)


def test_version_contract_rejects_stale_deployment():
    response = result(json.dumps({"version": "old"}))

    with pytest.raises(smoke.SmokeFailure, match="배포 버전 불일치"):
        smoke._require_version(response, "new")


def test_health_contract_requires_ok():
    smoke._require_health(result(json.dumps({"status": "ok"})))

    with pytest.raises(smoke.SmokeFailure, match="상태가 ok가 아닙니다"):
        smoke._require_health(result(json.dumps({"status": "degraded"})))


def test_run_smoke_checks_can_skip_api(monkeypatch):
    paths: list[str] = []

    def fake_fetch(base_url: str, path: str, timeout: float):
        del base_url, timeout
        paths.append(path)
        if path == "/":
            return result(
                "Program Studio",
                headers={
                    "strict-transport-security": "max-age=31536000",
                    "content-security-policy": "default-src 'self'",
                    "x-content-type-options": "nosniff",
                    "x-frame-options": "DENY",
                },
            )
        if path == "/login.html":
            return result("Google로 계속하기 js/firebase-config.js")
        if path == "/version.json":
            return result(json.dumps({"version": "2026.07.29.005"}))
        raise AssertionError(path)

    monkeypatch.setattr(smoke, "_fetch", fake_fetch)
    smoke.run_smoke_checks(
        "https://example.test",
        expected_version="2026.07.29.005",
        include_api=False,
        attempts=1,
        delay_seconds=0,
    )

    assert paths == ["/", "/login.html", "/version.json"]


def test_retry_reports_final_failure_without_sleep(monkeypatch):
    monkeypatch.setattr(smoke.time, "sleep", lambda _: None)
    attempts = 0

    def fail():
        nonlocal attempts
        attempts += 1
        raise smoke.SmokeFailure("not ready")

    with pytest.raises(smoke.SmokeFailure, match="최종 실패"):
        smoke._retry("test", fail, attempts=3, delay_seconds=0)

    assert attempts == 3


def test_preview_and_production_workflows_run_smoke_checks():
    preview = (ROOT / ".github/workflows/firebase-preview.yml").read_text(encoding="utf-8")
    production = (ROOT / ".github/workflows/firebase-deploy.yml").read_text(encoding="utf-8")

    assert "scripts/smoke_deployment.py" in preview
    assert "--skip-api" in preview
    assert "steps.deploy.outputs.preview_url" in preview
    assert "scripts/smoke_deployment.py" in production
    assert "https://program-tool.web.app" in production
    assert "--skip-api" not in production
    assert "cancel-in-progress: false" in production
