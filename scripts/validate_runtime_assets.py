#!/usr/bin/env python3
"""Validate local runtime assets and canonical ownership contracts."""

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
RETIRED_RUNTIME_ASSETS = (
    Path("js/home-premium-ui.js"),
    Path("js/home-hero-console-v2.js"),
    Path("js/home-dashboard-v2.js"),
    Path("js/home-header-footer-refine.js"),
    Path("js/home-hero-upgrade.js"),
    Path("js/home-pdf-utility-name-sync.js"),
    Path("js/home-print-workflow.js"),
    Path("js/home-professional-suite.js"),
    Path("js/home-program-catalog.js"),
    Path("js/ai-design-feature-gate.js"),
    Path("js/pdf-utility-first-paint.js"),
    Path("js/pdf-utility-cost-policy-hardening.js"),
)
RETIRED_COMPAT_FILES = (
    Path("tools/preflight.html"),
    Path("tools/pdf-Checker.html"),
)
ASSET_LITERAL_RE = re.compile(r"[\'\"`](/(?:js|css)/[^\'\"`\s]+)[\'\"`]")
LOAD_RE = re.compile(r"load\(\s*[\'\"](?P<id>[^\'\"]+)[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]")
SCOPED_LOAD_RE = re.compile(r"loadScopedScript\(\s*[\'\"](?P<id>[^\'\"]+)[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]")
MANIFEST_ENTRY_RE = re.compile(r"\{\s*id\s*:\s*[\'\"](?P<id>[^\'\"]+)[\'\"]\s*,\s*src\s*:\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]")
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
        return ["PDF preflight canonical runtime manifest is empty"]
    if len(ids) != len(set(ids)):
        errors.append(f"PDF preflight runtime has duplicate script ids: {ids}")
    if len(paths) != len(set(paths)):
        errors.append(f"PDF preflight runtime has duplicate asset requests: {paths}")

    owned_ids = set(ids)
    owned_paths = set(paths)
    for relative in PREFLIGHT_NON_OWNERS:
        for script_id, src in collect_script_entries(active_js(source_text[relative])):
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

    sw_text = active_js(source_text[Path("js/sw-register.js")])
    ui_text = active_js(source_text[Path("js/program-studio-ui-v2.js")])
    if "navigator.serviceWorker.register" in sw_text or "serviceWorker.register(" in sw_text:
        errors.append("js/sw-register.js must clean up retired workers, not register a new service worker")
    if not (ROOT / "sw.js").is_file():
        errors.append("sw.js compatibility artifact is missing; keep it while old clients may still request it")

    for retired in RETIRED_RUNTIME_ASSETS:
        filename = retired.name
        if filename in sw_text or filename in ui_text:
            errors.append(f"Retired runtime asset is still referenced by shared runtime: {filename}")
        if (ROOT / retired).exists():
            errors.append(f"Retired legacy asset was reintroduced: {retired.as_posix()}")
    for retired in RETIRED_COMPAT_FILES:
        if (ROOT / retired).exists():
            errors.append(f"Retired compatibility file was reintroduced: {retired.as_posix()}")
    if "if(isHome())" in sw_text:
        errors.append("Static home must not regain a dynamic home-overlay loader")

    if errors:
        print("Runtime asset validation failed:", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        raise SystemExit(1)

    print(
        "Runtime assets OK: "
        f"{len(dynamic_assets)} local dynamic asset(s) exist; "
        f"preflight canonical modules {len(collect_script_entries(source_text[PREFLIGHT_RUNTIME]))}; "
        "static home has no overlay helpers; "
        f"retired runtime assets absent: {len(RETIRED_RUNTIME_ASSETS)}"
    )


if __name__ == "__main__":
    validate()
