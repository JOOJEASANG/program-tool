#!/usr/bin/env python3
"""Verify first-party delivery budgets and HTTP policy on a deployed Firebase preview."""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

from validate_route_budgets import UI, SW, collect_routes

USER_AGENT = "ProgramStudioPreviewDelivery/1.0"
NETWORK_RETRY_ATTEMPTS = 4
NETWORK_RETRY_BASE_DELAY_SECONDS = 0.6
ROUTE_PATHS = {
    "home": "/",
    "admin": "/admin.html",
    "design-general": "/design-editor/general?embed=1&mode=poster&preset=poster-a4&orientation=portrait",
    "pdf-editor": "/pdf-editor/",
}
ROUTE_DELIVERY_BUDGETS = {
    "home": (24, 420_000),
    "admin": (24, 560_000),
    "design-general": (54, 1_800_000),
    "pdf-editor": (42, 1_500_000),
}
SECURITY_HEADERS = {
    "strict-transport-security": ("max-age=",),
    "content-security-policy": (
        "default-src 'self'",
        "object-src 'none'",
        "frame-ancestors 'self'",
    ),
    "x-content-type-options": ("nosniff",),
    "x-frame-options": ("sameorigin",),
    "referrer-policy": ("strict-origin-when-cross-origin",),
    "cross-origin-opener-policy": ("same-origin-allow-popups",),
    "cross-origin-resource-policy": ("same-site",),
    "permissions-policy": ("camera=()", "microphone=()", "geolocation=()"),
}


class DeliveryFailure(RuntimeError):
    """Raised when deployed delivery no longer satisfies the release contract."""


@dataclass(frozen=True)
class HttpMetric:
    url: str
    status: int
    content_type: str
    cache_control: str
    body_bytes: int
    elapsed_ms: float


class BootstrapAssetParser(HTMLParser):
    """Collect only first-party bootstrap candidates, not normal navigation links."""

    def __init__(self) -> None:
        super().__init__()
        self.raw_assets: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): (value or "") for key, value in attrs}
        tag = tag.lower()
        if tag == "script" and values.get("src"):
            self.raw_assets.append(values["src"])
            return
        if tag != "link" or not values.get("href"):
            return
        rel = {part.strip().lower() for part in values.get("rel", "").split() if part.strip()}
        if rel & {"stylesheet", "icon", "preload", "modulepreload"}:
            self.raw_assets.append(values["href"])


ALLOWED_PREVIEW_HOST_RE = re.compile(
    r"^(?:program-tool\.web\.app|program-tool--pr-[a-z0-9-]+\.web\.app)$",
    re.IGNORECASE,
)


def normalize_base_url(value: str) -> str:
    base = str(value or "").strip()
    if not base.startswith("https://"):
        raise DeliveryFailure("preview delivery verification requires https://")
    parts = urlsplit(base)
    if not ALLOWED_PREVIEW_HOST_RE.fullmatch(parts.hostname or ""):
        raise DeliveryFailure(f"unapproved Firebase preview host: {parts.hostname!r}")
    return base.rstrip("/") + "/"


def same_origin_asset(base_url: str, page_url: str, raw: str) -> str | None:
    raw = str(raw or "").strip()
    if not raw or raw.startswith(("data:", "blob:", "javascript:", "#")):
        return None
    absolute = urljoin(page_url, raw)
    base_parts = urlsplit(base_url)
    parts = urlsplit(absolute)
    if (parts.scheme, parts.netloc) != (base_parts.scheme, base_parts.netloc):
        return None
    path = parts.path or "/"
    return path + (f"?{parts.query}" if parts.query else "")


def extract_bootstrap_assets(base_url: str, page_url: str, html: str) -> list[str]:
    parser = BootstrapAssetParser()
    parser.feed(html)
    assets = [
        asset
        for raw in parser.raw_assets
        if (asset := same_origin_asset(base_url, page_url, raw)) is not None
    ]
    return assets


def _fetch(base_url: str, path: str, timeout: float) -> tuple[HttpMetric, bytes, dict[str, str]]:
    url = urljoin(base_url, path.lstrip("/"))
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Encoding": "identity",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    last_network_error: BaseException | None = None
    for attempt in range(1, NETWORK_RETRY_ATTEMPTS + 1):
        started = time.perf_counter()
        try:
            with urlopen(request, timeout=timeout) as response:
                body = response.read()
                elapsed_ms = (time.perf_counter() - started) * 1000.0
                headers = {key.lower(): value for key, value in response.headers.items()}
                metric = HttpMetric(
                    url=response.geturl(),
                    status=int(response.status),
                    content_type=headers.get("content-type", ""),
                    cache_control=headers.get("cache-control", ""),
                    body_bytes=len(body),
                    elapsed_ms=round(elapsed_ms, 2),
                )
                return metric, body, headers
        except HTTPError as error:
            body = error.read() if error.fp else b""
            raise DeliveryFailure(f"{url} returned HTTP {error.code}: {body[:160]!r}") from error
        except (URLError, TimeoutError, OSError) as error:
            last_network_error = error
            if attempt >= NETWORK_RETRY_ATTEMPTS:
                break
            time.sleep(NETWORK_RETRY_BASE_DELAY_SECONDS * attempt)

    reason = getattr(last_network_error, "reason", last_network_error)
    raise DeliveryFailure(
        f"{url} connection failed after {NETWORK_RETRY_ATTEMPTS} attempts: {reason}"
    ) from last_network_error


def require_security_headers(url: str, headers: dict[str, str]) -> None:
    failures: list[str] = []
    for name, fragments in SECURITY_HEADERS.items():
        actual = headers.get(name, "")
        lowered = actual.lower()
        missing = [fragment for fragment in fragments if fragment.lower() not in lowered]
        if missing:
            failures.append(f"{name}={actual!r}")
    if failures:
        raise DeliveryFailure(f"{url} security header contract failed: {', '.join(failures)}")


def require_cache_policy(metric: HttpMetric, *, html: bool = False) -> None:
    cache = metric.cache_control.lower()
    if "immutable" in cache:
        raise DeliveryFailure(f"{metric.url} unexpectedly uses immutable caching: {metric.cache_control!r}")
    if html:
        if "no-store" not in cache and not ("no-cache" in cache and "must-revalidate" in cache):
            raise DeliveryFailure(f"{metric.url} HTML cache policy is not safely revalidated: {metric.cache_control!r}")
        return

    path = urlsplit(metric.url).path.lower()
    if path.endswith((".js", ".css")) and "no-cache" not in cache:
        raise DeliveryFailure(f"{metric.url} code asset must be no-cache: {metric.cache_control!r}")
    if path in {"/sw.js", "/version.json"} and "no-store" not in cache:
        raise DeliveryFailure(f"{metric.url} mutable control asset must be no-store: {metric.cache_control!r}")


def require_mime(metric: HttpMetric, *, html: bool = False) -> None:
    content_type = metric.content_type.lower()
    path = urlsplit(metric.url).path.lower()
    if html and "text/html" not in content_type:
        raise DeliveryFailure(f"{metric.url} expected HTML MIME, got {metric.content_type!r}")
    if path.endswith(".js") and "javascript" not in content_type:
        raise DeliveryFailure(f"{metric.url} expected JavaScript MIME, got {metric.content_type!r}")
    if path.endswith(".css") and "text/css" not in content_type:
        raise DeliveryFailure(f"{metric.url} expected CSS MIME, got {metric.content_type!r}")
    if path.endswith(".json") and "json" not in content_type:
        raise DeliveryFailure(f"{metric.url} expected JSON MIME, got {metric.content_type!r}")
    if path.endswith(".svg") and "image/svg+xml" not in content_type:
        raise DeliveryFailure(f"{metric.url} expected SVG MIME, got {metric.content_type!r}")


def fetch_assets(
    base_url: str,
    assets: Iterable[str],
    *,
    timeout: float,
    workers: int,
) -> list[HttpMetric]:
    unique = sorted(set(assets))
    metrics: list[HttpMetric] = []
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = {pool.submit(_fetch, base_url, asset, timeout): asset for asset in unique}
        for future in as_completed(futures):
            asset = futures[future]
            try:
                metric, _body, headers = future.result()
            except Exception as error:
                raise DeliveryFailure(f"bootstrap asset failed: {asset}: {error}") from error
            if metric.status != 200:
                raise DeliveryFailure(f"{metric.url} returned unexpected status {metric.status}")
            require_mime(metric)
            require_cache_policy(metric)
            require_security_headers(metric.url, headers)
            metrics.append(metric)
    return sorted(metrics, key=lambda item: item.url)


def route_runtime_assets() -> dict[str, set[str]]:
    sw_text = Path(SW).read_text(encoding="utf-8")
    ui_text = Path(UI).read_text(encoding="utf-8")
    return collect_routes(sw_text, ui_text)


def percentile_95(values: list[float]) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return round(values[0], 2)
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(round(0.95 * (len(ordered) - 1)))))
    return round(ordered[index], 2)


def verify_route(
    base_url: str,
    route_name: str,
    route_path: str,
    dynamic_assets: set[str],
    *,
    timeout: float,
    workers: int,
) -> dict[str, object]:
    html_metric, html_body, html_headers = _fetch(base_url, route_path, timeout)
    if html_metric.status != 200:
        raise DeliveryFailure(f"{route_name}: HTML returned status {html_metric.status}")
    require_mime(html_metric, html=True)
    require_cache_policy(html_metric, html=True)
    require_security_headers(html_metric.url, html_headers)

    html_text = html_body.decode("utf-8", errors="replace")
    static_assets = extract_bootstrap_assets(base_url, html_metric.url, html_text)
    normalized_static = [urlsplit(asset).path for asset in static_assets]
    if len(normalized_static) != len(set(normalized_static)):
        duplicates = sorted({item for item in normalized_static if normalized_static.count(item) > 1})
        raise DeliveryFailure(f"{route_name}: duplicate first-party bootstrap references {duplicates}")

    asset_by_path = {urlsplit(asset).path: asset for asset in dynamic_assets}
    for asset in static_assets:
        asset_by_path[urlsplit(asset).path] = asset
    asset_metrics = fetch_assets(base_url, asset_by_path.values(), timeout=timeout, workers=workers)
    request_count = 1 + len(asset_metrics)
    body_bytes = html_metric.body_bytes + sum(metric.body_bytes for metric in asset_metrics)
    count_budget, byte_budget = ROUTE_DELIVERY_BUDGETS[route_name]

    if request_count > count_budget:
        raise DeliveryFailure(
            f"{route_name}: {request_count} first-party bootstrap requests exceed budget {count_budget}"
        )
    if body_bytes > byte_budget:
        raise DeliveryFailure(
            f"{route_name}: {body_bytes:,} delivered bytes exceed budget {byte_budget:,}"
        )

    elapsed_values = [html_metric.elapsed_ms, *(metric.elapsed_ms for metric in asset_metrics)]
    return {
        "route": route_name,
        "path": route_path,
        "request_count": request_count,
        "request_budget": count_budget,
        "body_bytes": body_bytes,
        "byte_budget": byte_budget,
        "response_ms_median": round(statistics.median(elapsed_values), 2),
        "response_ms_p95_diagnostic": percentile_95(elapsed_values),
        "html": asdict(html_metric),
        "assets": [asdict(metric) for metric in asset_metrics],
    }


def run(
    base_url: str,
    *,
    timeout: float = 20.0,
    workers: int = 8,
) -> dict[str, object]:
    base_url = normalize_base_url(base_url)
    dynamic_routes = route_runtime_assets()
    if set(ROUTE_PATHS) != set(ROUTE_DELIVERY_BUDGETS) or set(ROUTE_PATHS) != set(dynamic_routes):
        raise DeliveryFailure(
            "Phase 11 route delivery contracts drifted from validate_route_budgets.py"
        )

    route_reports = []
    for route_name, route_path in ROUTE_PATHS.items():
        report = verify_route(
            base_url,
            route_name,
            route_path,
            dynamic_routes[route_name],
            timeout=timeout,
            workers=workers,
        )
        route_reports.append(report)
        print(
            "PASS preview delivery "
            f"{route_name}: {report['request_count']}/{report['request_budget']} requests, "
            f"{report['body_bytes']:,}/{report['byte_budget']:,} bytes, "
            f"p95 {report['response_ms_p95_diagnostic']} ms (diagnostic only)"
        )

    return {
        "base_url": base_url,
        "latency_is_diagnostic_only": True,
        "routes": route_reports,
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--report", default="")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        report = run(args.base_url, timeout=max(1.0, args.timeout), workers=max(1, args.workers))
    except DeliveryFailure as error:
        print(f"PREVIEW DELIVERY FAILED: {error}", file=sys.stderr)
        return 1

    if args.report:
        path = Path(args.report)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Preview delivery report: {path}")

    print("PREVIEW DELIVERY PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
