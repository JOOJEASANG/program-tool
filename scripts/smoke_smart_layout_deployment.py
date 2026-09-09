#!/usr/bin/env python3
"""Verify the smart print layout page and deployed home launcher exist in Hosting."""
from __future__ import annotations

import argparse
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "https://program-tool.web.app"
USER_AGENT = "ProgramStudioSmartLayoutSmoke/1.0"


def fetch_text(base_url: str, path: str, timeout: float) -> tuple[str, str]:
    url = urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
    request = Request(url, headers={"User-Agent": USER_AGENT, "Cache-Control": "no-cache", "Pragma": "no-cache"})
    try:
        with urlopen(request, timeout=timeout) as response:
            if int(response.status) != 200:
                raise RuntimeError(f"HTTP {response.status}")
            return response.geturl(), response.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError) as error:
        raise RuntimeError(f"{url} 요청 실패: {error}") from error


def verify(base_url: str, timeout: float) -> None:
    final_url, page = fetch_text(base_url, "/smart-print-layout", timeout)
    actual_path = urlparse(final_url).path.rstrip("/") or "/"
    if actual_path != "/smart-print-layout":
        raise RuntimeError(f"스마트 인쇄배치 경로가 보존되지 않았습니다: {actual_path}")
    for marker in ('data-smart-print-layout="1"', "스마트 인쇄배치", "/js/smart-print-layout/app.js"):
        if marker not in page:
            raise RuntimeError(f"스마트 인쇄배치 페이지에서 필수 항목을 찾지 못했습니다: {marker}")

    _, launcher = fetch_text(base_url, "/js/pdf-suite-home-launcher.js?v=20260910-1", timeout)
    for marker in ("id:'smart-print-layout'", "name:'스마트 인쇄배치'", "url:'smart-print-layout/'", "pdf-home-five-programs-v7"):
        if marker not in launcher:
            raise RuntimeError(f"운영 홈 런처에서 스마트 인쇄배치 항목을 찾지 못했습니다: {marker}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--attempts", type=int, default=10)
    parser.add_argument("--delay-seconds", type=float, default=6.0)
    parser.add_argument("--timeout", type=float, default=25.0)
    args = parser.parse_args()

    last_error: Exception | None = None
    for attempt in range(1, max(1, args.attempts) + 1):
        try:
            verify(args.base_url, args.timeout)
            print("SMART PRINT LAYOUT PRODUCTION SMOKE PASSED")
            return 0
        except Exception as error:  # noqa: BLE001 - report deployment propagation failures
            last_error = error
            print(f"RETRY 스마트 인쇄배치 운영 경로 ({attempt}/{args.attempts}): {error}", file=sys.stderr)
            if attempt < args.attempts:
                time.sleep(max(0.0, args.delay_seconds))
    print(f"SMART PRINT LAYOUT PRODUCTION SMOKE FAILED: {last_error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
