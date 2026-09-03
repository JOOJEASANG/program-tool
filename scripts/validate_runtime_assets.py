#!/usr/bin/env python3
"""Validate JavaScript-created local assets and runtime ownership contracts."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREFLIGHT_RUNTIME = Path("js/pdf-preflight/route-runtime.js")
RUNTIME_SOURCES = (
    Path("js/sw-register.js"),
    Path("js/app-version.js"),
    Path("js/firebase-config.js"),
    Path("js/program-studio-ui-v2.js"),
    Path("js/pdf-editor/route-runtime.js"),
    Path("js/pdf-editor/core-runtime.js"),
    Path("js/pdf-editor/ui-runtime.js"),
    Path("js/pdf-editor/loader.js"),
    PREFLIGHT_RUNTIME,
)
CANONICAL_RUNTIME_OWNERS = (
    Path("js/sw-register.js"),
    Path("js/pdf-editor/route-runtime.js"),
    Path("js/pdf-editor/core-runtime.js"),
    Path("js/pdf-editor/ui-runtime.js"),
    PREFLIGHT_RUNTIME,
)
PREFLIGHT_NON_OWNERS = (
    Path("js/sw-register.js"),
    Path("js/app-version.js"),
    Path("js/program-studio-ui-v2.js"),
)
RETIRED_LEGACY_ASSETS = (
    Path("js/home-premium-ui.js"),
    Path("js/home-hero-console-v2.js"),
    Path("js/pdf-utility-first-paint.js"),
    Path("js/pdf-utility-cost-policy-hardening.js"),
    Path("tools/preflight.html"),
    Path("tools/pdf-Checker.html"),
)
HOME_DYNAMIC_COUNT_BUDGET = 10
HOME_DYNAMIC_BYTES_BUDGET = 88_000
ASSET_LITERAL_RE = re.compile(r"[\'\"`](/(?:js|css)/[^\'\"`\s]+)[\'\"`]")
LOAD_RE = re.compile(
    r"load\(\s*[\'\"](?P<id>[^\'\"]+)[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]"
)
SCOPED_LOAD_RE = re.compile(
    r"loadScopedScript\(\s*[\'\"](?P<id>[^\'\"]+)[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]"
)
MANIFEST_ENTRY_RE = re.compile(
    r"\{\s*id\s*:\s*[\'\"](?P<id>[^\'\"]+)[\'\"]\s*,\s*src\s*:\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]"
)
HOME_DASHBOARD_RE = re.compile(
    r"loadEnhancement\(\s*[\'\"]homeDashboardV2Script[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]"
)
BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.S)


def read(relative: Path) -> str:
    path = ROOT / relative
    if not path.is_file():
        raise AssertionError(f"Required runtime source is missing: {relative.as_posix()}")
    return path.read_text(encoding="utf-8")


def active_js(text: str) -> str:
    return BLOCK_COMMENT_RE.sub("", text)


def normalize_asset(raw: str) -> str:
    return raw.split("?", 1)[0].split("#", 1)[0]


def filesystem_path(asset: str) -> Path:
    return ROOT / asset.lstrip("/")


def collect_literal_assets(source_text: str) -> set[str]:
    return {normalize_asset(match.group(1)) for match in ASSET_LITERAL_RE.finditer(source_text)}


def collect_script_entries(source_text: str) -> list[tuple[str, str]]:
    text = active_js(source_text)
    entries: list[tuple[str, str]] = []
    for pattern in (LOAD_RE, SCOPED_LOAD_RE, MANIFEST_ENTRY_RE):
        entries.extend((match.group("id"), match.group("src")) for match in pattern.finditer(text))
    return entries


def validate_observer_runtime_ownership(source_text: dict[Path, str]) -> list[str]:
    errors: list[str] = []
    observer_entries = collect_script_entries(source_text[Path("js/app-version.js")])
    observer_by_id: dict[str, set[str]] = {}
    for script_id, src in observer_entries:
        observer_by_id.setdefault(script_id, set()).add(src)

    canonical_by_id: dict[str, list[tuple[Path, str]]] = {}
    for relative in CANONICAL_RUNTIME_OWNERS:
        for script_id, src in collect_script_entries(source_text[relative]):
            canonical_by_id.setdefault(script_id, []).append((relative, src))

    for script_id, observer_sources in sorted(observer_by_id.items()):
        owners = canonical_by_id.get(script_id, [])
        if owners:
            owner_text = ", ".join(f"{path.as_posix()} -> {src}" for path, src in owners)
            errors.append(
                "app-version.js duplicates canonical runtime script id "
                f"{script_id!r} ({sorted(observer_sources)!r}); owned by {owner_text}"
            )
        if len(observer_sources) > 1:
            errors.append(
                f"app-version.js maps script id {script_id!r} to conflicting sources: {sorted(observer_sources)!r}"
            )
    return errors


def validate_preflight_runtime_ownership(source_text: dict[Path, str]) -> list[str]:
    errors: list[str] = []
    entries = collect_script_entries(source_text[PREFLIGHT_RUNTIME])
    ids = [script_id for script_id, _ in entries]
    paths = [normalize_asset(src) for _, src in entries]
    if not entries:
        errors.append("PDF preflight canonical runtime manifest is empty")
        return errors
    if len(ids) != len(set(ids)):
        errors.append(f"PDF preflight runtime has duplicate script ids: {ids}")
    if len(paths) != len(set(paths)):
        errors.append(f"PDF preflight runtime has duplicate asset requests: {paths}")

    owned_ids = set(ids)
    owned_paths = set(paths)
    for relative in PREFLIGHT_NON_OWNERS:
        text = active_js(source_text[relative])
        for script_id, src in collect_script_entries(text):
            normalized = normalize_asset(src)
            if script_id in owned_ids or normalized in owned_paths:
                errors.append(
                    f"PDF preflight runtime asset is also owned by {relative.as_posix()}: {script_id} -> {normalized}"
                )
    if "pdfPreflightPanelBalanceScriptV1" not in ids:
        errors.append("PDF preflight final clean-workspace UI module is missing from canonical runtime")
    elif ids[-1] != "pdfPreflightPanelBalanceScriptV1":
        errors.append("PDF preflight clean-workspace UI must load last to prevent old-screen overwrite")
    return errors


def collect_home_dynamic_assets(sw_text: str, ui_text: str) -> list[str]:
    helpers_start = sw_text.find("async function helpers(){")
    admin_start = sw_text.find("if(isPath('/admin','/admin.html'))", helpers_start)
    if helpers_start < 0 or admin_start < 0:
        raise AssertionError("Could not isolate public/home helper manifest in js/sw-register.js")
    block = active_js(sw_text[helpers_start:admin_start])
    entries = [(match.group("id"), normalize_asset(match.group("src"))) for match in LOAD_RE.finditer(block)]
    if "loadCatalogCore()" not in block:
        raise AssertionError("Home helper manifest no longer loads the program catalog core")
    catalog_match = re.search(
        r"function loadCatalogCore\(\)\{\s*return load\(\s*[\'\"](?P<id>[^\'\"]+)[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]",
        active_js(sw_text),
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
        for asset in collect_literal_assets(active_js(text)):
            dynamic_assets.add(asset)
            if not filesystem_path(asset).is_file():
                errors.append(f"Missing dynamic asset: {asset} (referenced by {relative.as_posix()})")

    errors.extend(validate_observer_runtime_ownership(source_text))
    errors.extend(validate_preflight_runtime_ownership(source_text))

    sw_text = source_text[Path("js/sw-register.js")]
    ui_text = source_text[Path("js/program-studio-ui-v2.js")]
    if "navigator.serviceWorker.register" in active_js(sw_text) or "serviceWorker.register(" in active_js(sw_text):
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
        errors.append(f"Home dynamic helper count {len(home_assets)} exceeds budget {HOME_DYNAMIC_COUNT_BUDGET}")
    if home_bytes > HOME_DYNAMIC_BYTES_BUDGET:
        errors.append(f"Home dynamic helper bytes {home_bytes:,} exceed budget {HOME_DYNAMIC_BYTES_BUDGET:,}")

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
        f"preflight canonical modules {len(collect_script_entries(source_text[PREFLIGHT_RUNTIME]))}; "
        f"home helpers {len(home_assets)}/{HOME_DYNAMIC_COUNT_BUDGET}, "
        f"{home_bytes:,}/{HOME_DYNAMIC_BYTES_BUDGET:,} bytes; "
        f"retired legacy assets absent: {len(RETIRED_LEGACY_ASSETS)}"
    )


if __name__ == "__main__":
    validate()
