#!/usr/bin/env python3
"""Keep selected route bootstrap helper manifests within deterministic local budgets."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SW = ROOT / "js/sw-register.js"
UI = ROOT / "js/program-studio-ui-v2.js"
PDF_RUNTIME = ROOT / "js/pdf-editor/route-runtime.js"
PREFLIGHT_RUNTIME = ROOT / "js/pdf-preflight/route-runtime.js"
ASSET_RE = re.compile(r"[\'\"`](/js/[^\'\"`\s]+)[\'\"`]")
MANIFEST_RE = re.compile(r"\{\s*id\s*:\s*[\'\"][^\'\"]+[\'\"]\s*,\s*src\s*:\s*[\'\"](?P<src>/js/[^\'\"]+)")
LOAD_CATALOG_RE = re.compile(r"function loadCatalogCore\(\)\{\s*return load\([^,]+,[\'\"](?P<src>/js/[^\'\"]+)")

# Phase 10/11 shared delivery routes. Keep this set stable because
# verify_preview_delivery.py intentionally mirrors it.
ROUTE_BUDGETS = {
    "home": (10, 88_000),
    "admin": (10, 180_000),
    "pdf-editor": (24, 950_000),
}
# PDF preflight is approval-gated and owns a nested canonical manifest. Validate
# its local bootstrap independently without changing the older preview contract.
PREFLIGHT_ROUTE_BUDGET = (22, 1_100_000)
UI_ENHANCEMENTS = {
    "home": "homeDashboardV2Script",
    "admin": "adminWorkflowV2Script",
}


def normalize(raw: str) -> str:
    return raw.split("?", 1)[0].split("#", 1)[0]


def assets(text: str) -> set[str]:
    return {normalize(match.group(1)) for match in ASSET_RE.finditer(text)}


def manifest_assets(path: Path) -> set[str]:
    text = path.read_text(encoding="utf-8")
    found = {normalize(match.group("src")) for match in MANIFEST_RE.finditer(text)}
    if not found:
        raise AssertionError(f"Could not resolve canonical runtime manifest: {path.relative_to(ROOT).as_posix()}")
    return found


def segment(text: str, start: str, end: str) -> str:
    left = text.find(start)
    right = text.find(end, left + len(start)) if left >= 0 else -1
    if left < 0 or right < 0:
        raise AssertionError(f"Could not isolate runtime segment: {start!r} -> {end!r}")
    return text[left:right]


def ui_asset(ui_text: str, script_id: str) -> str:
    match = re.search(
        rf"loadEnhancement\(\s*[\'\"]{re.escape(script_id)}[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)",
        ui_text,
    )
    if not match:
        raise AssertionError(f"Could not resolve UI enhancement: {script_id}")
    return normalize(match.group("src"))


def collect_routes(sw_text: str, ui_text: str) -> dict[str, set[str]]:
    common = assets(segment(sw_text, "async function helpers(){", "if(isHome()){"))
    catalog_match = LOAD_CATALOG_RE.search(sw_text)
    if not catalog_match:
        raise AssertionError("Could not resolve loadCatalogCore()")
    catalog = normalize(catalog_match.group("src"))
    home = common | assets(segment(sw_text, "if(isHome()){", "if(isPath('/admin','/admin.html')){")) | {catalog}
    admin = common | assets(segment(sw_text, "if(isPath('/admin','/admin.html')){", "if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'))")) | {catalog}
    routes = {
        "home": home,
        "admin": admin,
        "pdf-editor": common | manifest_assets(PDF_RUNTIME),
    }
    for route, script_id in UI_ENHANCEMENTS.items():
        routes[route].add(ui_asset(ui_text, script_id))
    return routes


def _check_budget(route: str, route_assets: set[str], budget: tuple[int, int], errors: list[str]) -> str:
    count_budget, byte_budget = budget
    missing = [asset for asset in sorted(route_assets) if not (ROOT / asset.lstrip("/")).is_file()]
    if missing:
        errors.append(f"{route}: missing bootstrap assets {missing}")
        return f"{route}=missing"
    byte_count = sum((ROOT / asset.lstrip("/")).stat().st_size for asset in route_assets)
    if len(route_assets) > count_budget:
        errors.append(f"{route}: {len(route_assets)} assets exceed count budget {count_budget}")
    if byte_count > byte_budget:
        errors.append(f"{route}: {byte_count:,} bytes exceed budget {byte_budget:,}")
    return f"{route}={len(route_assets)}/{count_budget} assets, {byte_count:,}/{byte_budget:,} bytes"


def validate() -> None:
    errors: list[str] = []
    sw_text = SW.read_text(encoding="utf-8")
    ui_text = UI.read_text(encoding="utf-8")
    try:
        routes = collect_routes(sw_text, ui_text)
        preflight_assets = manifest_assets(PREFLIGHT_RUNTIME)
    except AssertionError as error:
        print(f"Route budget validation failed: {error}", file=sys.stderr)
        raise SystemExit(1)

    summaries = [
        _check_budget(route, route_assets, ROUTE_BUDGETS[route], errors)
        for route, route_assets in routes.items()
    ]
    summaries.append(_check_budget("pdf-preflight", preflight_assets, PREFLIGHT_ROUTE_BUDGET, errors))

    if errors:
        print("Route budget validation failed:", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        raise SystemExit(1)
    print("Route bootstrap budgets OK: " + "; ".join(summaries))


if __name__ == "__main__":
    validate()
