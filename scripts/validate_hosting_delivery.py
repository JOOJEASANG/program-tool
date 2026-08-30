#!/usr/bin/env python3
"""Validate Firebase Hosting stage, cache, and security header policy before deployment."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from prepare_hosting_dist import OUTPUT, build as build_hosting_dist

ROOT = Path(__file__).resolve().parents[1]
FIREBASE_JSON = ROOT / "firebase.json"
EXPECTED_PUBLIC = ".firebase-hosting"

REQUIRED_GLOBAL = {
    "strict-transport-security": ("max-age=31536000", "includesubdomains"),
    "x-content-type-options": ("nosniff",),
    "referrer-policy": ("strict-origin-when-cross-origin",),
    "x-frame-options": ("sameorigin",),
    "cross-origin-opener-policy": ("same-origin-allow-popups",),
    "cross-origin-resource-policy": ("same-site",),
    "permissions-policy": ("camera=()", "microphone=()", "geolocation=()"),
    "content-security-policy": (
        "default-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'self'",
        "form-action 'self'",
    ),
}
CACHE_CONTRACTS = {
    "**": ("no-cache", "must-revalidate"),
    "**/*.html": ("no-store", "must-revalidate"),
    "/": ("no-store", "must-revalidate"),
    "/sw.js": ("no-store", "must-revalidate"),
    "/version.json": ("no-store", "must-revalidate"),
    "**/*.@(js|css)": ("no-cache",),
}


def header_map(rule: dict[str, object]) -> dict[str, str]:
    headers = rule.get("headers") or []
    result: dict[str, str] = {}
    for item in headers:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip().lower()
        value = str(item.get("value") or "").strip()
        if key:
            result[key] = value
    return result


def source_rules(hosting: dict[str, object]) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for rule in hosting.get("headers") or []:
        if not isinstance(rule, dict):
            continue
        source = str(rule.get("source") or "").strip()
        if source:
            result[source] = header_map(rule)
    return result


def validate() -> None:
    payload = json.loads(FIREBASE_JSON.read_text(encoding="utf-8"))
    hosting = payload.get("hosting") or {}
    rules = source_rules(hosting)
    errors: list[str] = []

    public_dir = str(hosting.get("public") or "").strip()
    if public_dir != EXPECTED_PUBLIC:
        errors.append(
            f"Hosting public directory must be {EXPECTED_PUBLIC!r}, got {public_dir!r}"
        )

    try:
        build_hosting_dist()
    except Exception as error:
        errors.append(f"Hosting allowlist stage failed: {error}")

    if not OUTPUT.is_dir():
        errors.append(f"Hosting stage directory is missing: {OUTPUT.name}")

    global_headers = rules.get("**", {})
    for name, fragments in REQUIRED_GLOBAL.items():
        actual = global_headers.get(name, "")
        lowered = actual.lower()
        if any(fragment.lower() not in lowered for fragment in fragments):
            errors.append(f"global {name} contract missing: {actual!r}")

    for source, fragments in CACHE_CONTRACTS.items():
        actual = rules.get(source, {}).get("cache-control", "")
        lowered = actual.lower()
        if not actual:
            errors.append(f"{source}: Cache-Control rule missing")
            continue
        if any(fragment.lower() not in lowered for fragment in fragments):
            errors.append(f"{source}: Cache-Control mismatch: {actual!r}")

    for source, headers in rules.items():
        cache = headers.get("cache-control", "").lower()
        if "immutable" in cache:
            errors.append(
                f"{source}: immutable caching is forbidden until all runtime asset URLs are version-pinned"
            )

    if errors:
        print("Hosting delivery policy validation failed:", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        raise SystemExit(1)

    print(
        "Hosting delivery policy OK: allowlisted stage + global security headers + "
        "safe revalidation cache contracts; immutable caching remains disabled"
    )


if __name__ == "__main__":
    validate()
