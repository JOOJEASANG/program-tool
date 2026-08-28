#!/usr/bin/env python3
"""Validate JavaScript-created local assets and keep the home runtime within budget."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_SOURCES = (
    Path("js/sw-register.js"),
    Path("js/firebase-config.js"),
    Path("js/program-studio-ui-v2.js"),
    Path("js/design-editor/core-runtime.js"),
    Path("js/design-editor/shell-runtime.js"),
    Path("js/pdf-editor/route-runtime.js"),
    Path("js/pdf-editor/core-runtime.js"),
    Path("js/pdf-editor/ui-runtime.js"),
    Path("js/pdf-editor/loader.js"),
)
RETIRED_LEGACY_ASSETS = (
    Path("js/home-premium-ui.js"),
    Path("js/home-hero-console-v2.js"),
)
HOME_DYNAMIC_COUNT_BUDGET = 10
HOME_DYNAMIC_BYTES_BUDGET = 82_000
ASSET_LITERAL_RE = re.compile(r"[\'\"`](/(?:js|css)/[^\'\"`\s]+)[\'\"`]")
LOAD_RE = re.compile(
    r"load\(\s*[\'\"](?P<id>[^\'\"]+)[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]"
)
HOME_DASHBOARD_RE = re.compile(
    r"loadEnhancement\(\s*[\'\"]homeDashboardV2Script[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]"
)


def read(relative: Path) -> str:
    path = ROOT / relative
    if not path.is_file():
        raise AssertionError(f"Required runtime source is missing: {relative.as_posix()}")
    return path.read_text(encoding="utf-8")


def normalize_asset(raw: str) -> str:
    return raw.split("?", 1)[0].split("#", 1)[0]


def filesystem_path(asset: str) -> Path:
    return ROOT / asset.lstrip("/")


def collect_literal_assets(source_text: str) -> set[str]:
    return {normalize_asset(match.group(1)) for match in ASSET_LITERAL_RE.finditer(source_text)}


def collect_home_dynamic_assets(sw_text: str, ui_text: str) -> list[str]:
    helpers_start = sw_text.find("async function helpers(){")
    admin_start = sw_text.find("if(isPath('/admin','/admin.html'))", helpers_start)
    if helpers_start < 0 or admin_start < 0:
        raise AssertionError("Could not isolate public/home helper manifest in js/sw-register.js")

    block = sw_text[helpers_start:admin_start]
    entries = [(match.group("id"), normalize_asset(match.group("src"))) for match in LOAD_RE.finditer(block)]

    if "loadCatalogCore()" not in block:
        raise AssertionError("Home helper manifest no longer loads the program catalog core")
    catalog_match = re.search(
        r"function loadCatalogCore\(\)\{return load\(\s*[\'\"](?P<id>[^\'\"]+)[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]",
        sw_text,
    )
    if not catalog_match:
        raise AssertionError("Could not resolve loadCatalogCore() asset")
    entries.append((catalog_match.group("id"), normalize_asset(catalog_match.group("src"))))

    dashboard_match = HOME_DASHBOARD_RE.search(ui_text)
    if not dashboard_match:
        raise AssertionError("Could not resolve the home dashboard enhancement asset")
    entries.append(("homeDashboardV2Script", normalize_asset(dashboard_match.group("src"))))

    ids = [entry[0] for entry in entries]
    paths = [entry[1] for entry in entries]
    if len(ids) != len(set(ids)):
        raise AssertionError(f"Duplicate home runtime script ids: {ids}")
    if len(paths) != len(set(paths)):
        raise AssertionError(f"Duplicate home runtime asset requests: {paths}")
    return paths


def validate() -> None:
    source_text = {relative: read(relative) for relative in RUNTIME_SOURCES}
    errors: list[str] = []

    dynamic_assets: set[str] = set()
    for relative, text in source_text.items():
        for asset in collect_literal_assets(text):
            dynamic_assets.add(asset)
            if not filesystem_path(asset).is_file():
                errors.append(f"Missing dynamic asset: {asset} (referenced by {relative.as_posix()})")

    sw_text = source_text[Path("js/sw-register.js")]
    ui_text = source_text[Path("js/program-studio-ui-v2.js")]

    if "navigator.serviceWorker.register" in sw_text or "serviceWorker.register(" in sw_text:
        errors.append("js/sw-register.js must remain a retired-worker cleanup/runtime loader, not register a new service worker")
    if not (ROOT / "sw.js").is_file():
        errors.append("sw.js compatibility artifact is missing; keep it while old clients may still request it")

    try:
        home_assets = collect_home_dynamic_assets(sw_text, ui_text)
    except AssertionError as error:
        errors.append(str(error))
        home_assets = []

    home_bytes = 0
    for asset in home_assets:
        path = filesystem_path(asset)
        if path.is_file():
            home_bytes += path.stat().st_size
        else:
            errors.append(f"Missing home runtime asset: {asset}")

    if len(home_assets) > HOME_DYNAMIC_COUNT_BUDGET:
        errors.append(
            f"Home dynamic helper count {len(home_assets)} exceeds budget {HOME_DYNAMIC_COUNT_BUDGET}"
        )
    if home_bytes > HOME_DYNAMIC_BYTES_BUDGET:
        errors.append(
            f"Home dynamic helper bytes {home_bytes:,} exceed budget {HOME_DYNAMIC_BYTES_BUDGET:,}"
        )

    for retired in RETIRED_LEGACY_ASSETS:
        if (ROOT / retired).exists():
            errors.append(f"Retired legacy asset was reintroduced: {retired.as_posix()}")

    if errors:
        print("Runtime asset validation failed:", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        raise SystemExit(1)

    print(
        "Runtime assets OK: "
        f"{len(dynamic_assets)} local dynamic asset(s) exist; "
        f"home helpers {len(home_assets)}/{HOME_DYNAMIC_COUNT_BUDGET}, "
        f"{home_bytes:,}/{HOME_DYNAMIC_BYTES_BUDGET:,} bytes; "
        f"retired legacy assets absent: {len(RETIRED_LEGACY_ASSETS)}"
    )


if __name__ == "__main__":
    validate()
