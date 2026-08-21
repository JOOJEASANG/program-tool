#!/usr/bin/env python3
"""Verify a deployed Program Studio site from an end user's HTTP path."""
from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE_URL = "https://program-tool.web.app"
USER_AGENT = "ProgramStudioDeploymentSmoke/1.0"


class SmokeFailure(RuntimeError):
    """Raised when a deployed endpoint does not satisfy its contract."""


@dataclass(frozen=True)
class HttpResult:
    url: str
    status: int
    headers: dict[str, str]
    body: bytes

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")


def _normalize_base_url(value: str) -> str:
    base_url = str(value or "").strip()
    if not base_url.startswith(("https://", "http://")):
        raise SmokeFailure("배포 주소는 http:// 또는 https://로 시작해야 합니다.")
    return base_url.rstrip("/") + "/"


def _fetch(base_url: str, path: str, timeout: float) -> HttpResult:
    url = urljoin(base_url, path.lstrip("/"))
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read()
            return HttpResult(
                url=response.geturl(),
                status=int(response.status),
                headers={key.lower(): value for key, value in response.headers.items()},
                body=body,
            )
    except HTTPError as error:
        body = error.read() if error.fp else b""
        raise SmokeFailure(
            f"{url} 요청 실패: HTTP {error.code} {body[:200]!r}"
        ) from error
    except URLError as error:
        raise SmokeFailure(f"{url} 연결 실패: {error.reason}") from error


def _require_status_ok(result: HttpResult) -> None:
    if result.status != 200:
        raise SmokeFailure(f"{result.url} 응답 상태가 200이 아닙니다: {result.status}")


def _require_text(result: HttpResult, *needles: str) -> None:
    _require_status_ok(result)
    missing = [needle for needle in needles if needle not in result.text]
    if missing:
        raise SmokeFailure(
            f"{result.url} 응답에서 필수 문구를 찾지 못했습니다: {missing}"
        )


def _require_same_origin_frame_headers(result: HttpResult) -> None:
    _require_status_ok(result)
    frame_option = result.headers.get("x-frame-options", "")
    csp = result.headers.get("content-security-policy", "")
    failures: list[str] = []
    if frame_option.upper() != "SAMEORIGIN":
        failures.append(f"x-frame-options={frame_option!r}")
    if "frame-ancestors 'self'" not in csp.lower():
        failures.append(f"content-security-policy={csp!r}")
    if failures:
        raise SmokeFailure(
            f"{result.url} 동일 출처 iframe 허용 헤더가 올바르지 않습니다: {', '.join(failures)}"
        )


def _require_security_headers(result: HttpResult) -> None:
    _require_status_ok(result)
    required = {
        "strict-transport-security": "max-age=",
        "content-security-policy": "default-src 'self'",
        "x-content-type-options": "nosniff",
        "x-frame-options": "SAMEORIGIN",
    }
    failures: list[str] = []
    for header, expected in required.items():
        actual = result.headers.get(header, "")
        if expected.lower() not in actual.lower():
            failures.append(f"{header}={actual!r}")
    if failures:
        raise SmokeFailure(
            f"{result.url} 보안 헤더가 올바르지 않습니다: {', '.join(failures)}"
        )
    _require_same_origin_frame_headers(result)


def _require_version(result: HttpResult, expected_version: str) -> None:
    _require_status_ok(result)
    try:
        payload = json.loads(result.text)
    except json.JSONDecodeError as error:
        raise SmokeFailure(f"{result.url} 버전 JSON을 읽을 수 없습니다.") from error
    actual = str(payload.get("version") or "").strip()
    if actual != expected_version:
        raise SmokeFailure(
            f"배포 버전 불일치: deployed={actual!r}, expected={expected_version!r}"
        )


def _require_health(result: HttpResult) -> None:
    _require_status_ok(result)
    try:
        payload = json.loads(result.text)
    except json.JSONDecodeError as error:
        raise SmokeFailure(f"{result.url} 상태 JSON을 읽을 수 없습니다.") from error
    if payload.get("status") != "ok":
        raise SmokeFailure(f"{result.url} 상태가 ok가 아닙니다: {payload!r}")


def expected_version_from_repository() -> str:
    data = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    version = str(data.get("version") or "").strip()
    if not version:
        raise SmokeFailure("version.json에 배포 버전이 없습니다.")
    return version


def _retry(
    label: str,
    operation: Callable[[], None],
    *,
    attempts: int,
    delay_seconds: float,
) -> None:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            operation()
            print(f"PASS {label}")
            return
        except Exception as error:  # noqa: BLE001 - report the final deployment failure
            last_error = error
            print(
                f"RETRY {label} ({attempt}/{attempts}): {error}",
                file=sys.stderr,
            )
            if attempt < attempts:
                time.sleep(delay_seconds)
    raise SmokeFailure(f"{label} 최종 실패: {last_error}") from last_error


def run_smoke_checks(
    base_url: str,
    *,
    expected_version: str,
    include_api: bool = True,
    attempts: int = 8,
    delay_seconds: float = 5.0,
    timeout: float = 20.0,
) -> None:
    base_url = _normalize_base_url(base_url)

    checks: list[tuple[str, Callable[[], None]]] = [
        (
            "홈 화면 및 보안 헤더",
            lambda: (
                lambda result: (
                    _require_text(result, "Program Studio"),
                    _require_security_headers(result),
                )
            )(_fetch(base_url, "/", timeout)),
        ),
        (
            "로그인 화면",
            lambda: _require_text(
                _fetch(base_url, "/login.html", timeout),
                "Google로 계속하기",
                "js/firebase-config.js",
            ),
        ),
        (
            "디자인 편집기 셸",
            lambda: (
                lambda result: (
                    _require_text(result, "디자인 편집기", "editorFrame", "/perfect-binding-cover/?embed=1&mode=cover", "/design-editor/general?"),
                    _require_same_origin_frame_headers(result),
                )
            )(_fetch(base_url, "/design-editor", timeout)),
        ),
        (
            "디자인 편집기 일반 모드",
            lambda: (
                lambda result: (
                    _require_text(result, "디자인 편집기", "presetGrid", "artboard"),
                    _require_same_origin_frame_headers(result),
                )
            )(_fetch(base_url, "/design-editor/general?embed=1&mode=poster&preset=poster-a4&orientation=portrait", timeout)),
        ),
        (
            "디자인 편집기 내장 표지",
            lambda: (
                lambda result: (
                    _require_text(result, "책표지제작", "Program Studio"),
                    _require_same_origin_frame_headers(result),
                )
            )(_fetch(base_url, "/perfect-binding-cover/?embed=1&mode=cover", timeout)),
        ),
        (
            "배포 버전",
            lambda: _require_version(
                _fetch(base_url, "/version.json", timeout),
                expected_version,
            ),
        ),
    ]
    if include_api:
        checks.append(
            (
                "Functions 상태",
                lambda: _require_health(
                    _fetch(base_url, "/api/health", timeout)
                ),
            )
        )

    for label, operation in checks:
        _retry(
            label,
            operation,
            attempts=max(1, attempts),
            delay_seconds=max(0.0, delay_seconds),
        )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--expected-version", default=None)
    parser.add_argument("--skip-api", action="store_true")
    parser.add_argument("--attempts", type=int, default=8)
    parser.add_argument("--delay-seconds", type=float, default=5.0)
    parser.add_argument("--timeout", type=float, default=20.0)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    expected_version = args.expected_version or expected_version_from_repository()
    try:
        run_smoke_checks(
            args.base_url,
            expected_version=expected_version,
            include_api=not args.skip_api,
            attempts=args.attempts,
            delay_seconds=args.delay_seconds,
            timeout=args.timeout,
        )
    except SmokeFailure as error:
        print(f"DEPLOYMENT SMOKE FAILED: {error}", file=sys.stderr)
        return 1
    print("DEPLOYMENT SMOKE PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
