#!/usr/bin/env python3
"""Keep selected route bootstrap helper manifests within deterministic local budgets."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SW = ROOT / "js/sw-register.js"
UI = ROOT / "js/program-studio-ui-v2.js"
ASSET_RE = re.compile(r"[\'\"`](/js/[^\'\"`\s]+)[\'\"`]")
LOAD_CATALOG_RE = re.compile(r"function loadCatalogCore\(\)\{return load\([^,]+,[\'\"](?P<src>/js/[^\'\"]+)")

ROUTE_BUDGETS = {
    "home": (10, 82_000),
    "admin": (10, 180_000),
    "design-general": (38, 1_200_000),
    "pdf-editor": (22, 900_000),
}
UI_ENHANCEMENTS = {
    "home": "homeDashboardV2Script",
    "admin": "adminWorkflowV2Script",
    "design-general": "designEditorWorkflowV2Script",
}
EDITOR_TOOL_RAIL_ID = "editorToolRailV1Script"
EDITOR_TOOL_RAIL_ROUTES = ("design-general",)


def normalize(raw: str) -> str:
    return raw.split("?", 1)[0].split("#", 1)[0]


def assets(text: str) -> set[str]:
    return {normalize(match.group(1)) for match in ASSET_RE.finditer(text)}


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
    admin = common | assets(segment(sw_text, "if(isPath('/admin','/admin.html')){", "// Legacy test/source marker kept intentionally:")) | {catalog}
    design = common | assets(segment(sw_text, "const DESIGN_EDITOR_RUNTIME_SCRIPTS=Object.freeze([", "]);\n  const DESIGN_EDITOR_GENERAL_ROUTE_IDS"))
    pdf_editor = common | assets(segment(
        sw_text,
        "if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html')){",
        "if(isPath('/tools/pdf-Checker.html','/tools/preflight.html','/pdf-preflight','/pdf-preflight/index.html')){",
    ))

    routes = {
        "home": home,
        "admin": admin,
        "design-general": design,
        "pdf-editor": pdf_editor,
    }
    for route, script_id in UI_ENHANCEMENTS.items():
        routes[route].add(ui_asset(ui_text, script_id))

    tool_rail = ui_asset(ui_text, EDITOR_TOOL_RAIL_ID)
    for route in EDITOR_TOOL_RAIL_ROUTES:
        routes[route].add(tool_rail)
    return routes


def validate() -> None:
    errors: list[str] = []
    sw_text = SW.read_text(encoding="utf-8")
    ui_text = UI.read_text(encoding="utf-8")

    try:
        routes = collect_routes(sw_text, ui_text)
    except AssertionError as error:
        print(f"Route budget validation failed: {error}", file=sys.stderr)
        raise SystemExit(1)

    summaries: list[str] = []
    for route, route_assets in routes.items():
        count_budget, byte_budget = ROUTE_BUDGETS[route]
        missing = [asset for asset in sorted(route_assets) if not (ROOT / asset.lstrip("/")).is_file()]
        if missing:
            errors.append(f"{route}: missing bootstrap assets {missing}")
            continue
        byte_count = sum((ROOT / asset.lstrip("/")).stat().st_size for asset in route_assets)
        if len(route_assets) > count_budget:
            errors.append(f"{route}: {len(route_assets)} assets exceed count budget {count_budget}")
        if byte_count > byte_budget:
            errors.append(f"{route}: {byte_count:,} bytes exceed budget {byte_budget:,}")
        summaries.append(f"{route}={len(route_assets)}/{count_budget} assets, {byte_count:,}/{byte_budget:,} bytes")

    if errors:
        print("Route budget validation failed:", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        raise SystemExit(1)

    print("Route bootstrap budgets OK: " + "; ".join(summaries))


if __name__ == "__main__":
    validate()
