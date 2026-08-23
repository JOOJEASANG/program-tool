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
    return smoke.HttpResult(url=url, status=status, headers=headers or {}, body=body.encode("utf-8"))


def frameable_headers() -> dict[str, str]:
    return {
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "content-security-policy": "default-src 'self'; frame-ancestors 'self'; object-src 'none'",
        "x-content-type-options": "nosniff",
        "x-frame-options": "SAMEORIGIN",
    }


def test_home_contract_requires_content_and_security_headers():
    response = result("<title>Program Studio</title>", headers=frameable_headers())
    smoke._require_text(response, "Program Studio")
    smoke._require_security_headers(response)


def test_security_header_failure_is_actionable():
    response = result("Program Studio", headers={})
    with pytest.raises(smoke.SmokeFailure, match="보안 헤더"):
        smoke._require_security_headers(response)


def test_design_editor_same_origin_frame_contract_rejects_deny():
    headers = frameable_headers()
    headers["x-frame-options"] = "DENY"
    headers["content-security-policy"] = "default-src 'self'; frame-ancestors 'none'"
    response = result("디자인 편집기", headers=headers)
    with pytest.raises(smoke.SmokeFailure, match="동일 출처 iframe"):
        smoke._require_same_origin_frame_headers(response)


def test_version_contract_rejects_stale_deployment():
    response = result(json.dumps({"version": "old"}))
    with pytest.raises(smoke.SmokeFailure, match="배포 버전 불일치"):
        smoke._require_version(response, "new")


def test_health_contract_requires_ok():
    smoke._require_health(result(json.dumps({"status": "ok"})))
    with pytest.raises(smoke.SmokeFailure, match="상태가 ok가 아닙니다"):
        smoke._require_health(result(json.dumps({"status": "degraded"})))


def test_design_runtime_manifest_assets_are_unique_and_javascript():
    entries = smoke.design_editor_runtime_assets()
    assert len(entries) == 29
    assert len({script_id for script_id, _ in entries}) == 29
    assert len({path for _, path in entries}) == 29
    smoke._require_javascript_asset(result("(function(){})();", headers={"content-type": "text/javascript; charset=utf-8"}, url="https://example.test/js/design-editor/test.js"))
    with pytest.raises(smoke.SmokeFailure, match="MIME"):
        smoke._require_javascript_asset(result("(function(){})();", headers={"content-type": "text/html"}))


def test_run_smoke_checks_can_skip_api(monkeypatch):
    paths: list[str] = []
    runtime_paths = [path for _, path in smoke.design_editor_runtime_assets()]
    runtime_path_set = set(runtime_paths)
    general_cover = "/design-editor/general?embed=1&mode=cover&preset=cover-a4"
    general_poster = "/design-editor/general?embed=1&mode=poster&preset=poster-a4&orientation=portrait"

    def fake_fetch(base_url: str, path: str, timeout: float):
        del base_url, timeout
        paths.append(path)
        if path == "/":
            return result("Program Studio", headers=frameable_headers())
        if path == "/login.html":
            return result("Google로 계속하기 js/firebase-config.js")
        if path == "/design-editor":
            return result(f"디자인 편집기 editorFrame {general_cover} /perfect-binding-cover/?embed=1&mode=cover /design-editor/general?", headers=frameable_headers())
        if path in (general_cover, general_poster):
            return result("디자인 편집기 presetGrid artboard", headers=frameable_headers())
        if path in runtime_path_set:
            return result("(function(){})();", headers={"content-type": "application/javascript; charset=utf-8"}, url=f"https://example.test{path}")
        if path == "/perfect-binding-cover/?embed=1&mode=cover":
            return result("책표지제작 · Program Studio", headers=frameable_headers())
        if path == "/version.json":
            return result(json.dumps({"version": "2026.07.29.005"}))
        raise AssertionError(path)

    monkeypatch.setattr(smoke, "_fetch", fake_fetch)
    smoke.run_smoke_checks("https://example.test", expected_version="2026.07.29.005", include_api=False, attempts=1, delay_seconds=0)

    assert paths[:5] == ["/", "/login.html", "/design-editor", general_cover, general_poster]
    assert paths[5:5 + len(runtime_paths)] == runtime_paths
    assert paths[-2:] == ["/perfect-binding-cover/?embed=1&mode=cover", "/version.json"]
    assert "/api/health" not in paths


def test_runtime_asset_failure_names_the_manifest_entry(monkeypatch):
    script_id, first_path = smoke.design_editor_runtime_assets()[0]

    def fake_fetch(base_url: str, path: str, timeout: float):
        del base_url, timeout
        if path == first_path:
            return result("<html>fallback</html>", headers={"content-type": "text/html"})
        raise AssertionError(path)

    monkeypatch.setattr(smoke, "_fetch", fake_fetch)
    with pytest.raises(smoke.SmokeFailure, match=script_id):
        smoke._require_design_editor_runtime_assets("https://example.test/", 1)


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
    assert "GITHUB_SHA:0:7" in preview
    assert "GITHUB_RUN_ATTEMPT" in preview
    assert 'echo "channel=$CHANNEL"' in preview
    assert "--attempts 12" in preview
    assert "scripts/smoke_deployment.py" in production
    assert "https://program-tool.web.app" in production
    assert "--skip-api" not in production
    assert "cancel-in-progress: false" in production
