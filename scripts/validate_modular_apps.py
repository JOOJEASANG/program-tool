#!/usr/bin/env python3
"""Validate the standalone app routes and shared-runtime boundaries."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_KEYS = (
    "cover",
    "poster",
    "flyer",
    "invitation",
    "notice",
    "leaflet",
    "pdf-layout",
    "booklet",
)
DESIGN_KEYS = {"cover", "poster", "flyer", "invitation", "notice", "leaflet"}
PDF_KEYS = {"pdf-layout", "booklet"}


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def validate() -> None:
    errors: list[str] = []
    required = (
        "apps/index.html",
        "css/studio-app-shell.css",
        "js/studio-app-shell.js",
        "js/modular-app-access.js",
        "js/design-editor/product-boundary-ui.js",
        "js/pdf-editor/app-boundary.js",
    )
    for relative in required:
        if not (ROOT / relative).is_file():
            errors.append(f"missing modular app asset: {relative}")

    firebase = json.loads(read("firebase.json"))
    rewrites = firebase.get("hosting", {}).get("rewrites", [])
    if not any(rule.get("source") == "/apps/**" and rule.get("destination") == "/apps/index.html" for rule in rewrites):
        errors.append("Firebase Hosting /apps/** rewrite is missing")

    shell = read("js/studio-app-shell.js")
    access = read("js/modular-app-access.js")
    home = read("js/home-program-catalog.js")
    design_core = read("js/design-editor/core-runtime.js")
    pdf_boundary = read("js/pdf-editor/app-boundary.js")
    hosting = read("scripts/prepare_hosting_dist.py")

    for key in APP_KEYS:
        if f"/apps/{key}" not in home:
            errors.append(f"home catalog does not expose /apps/{key}")
        if key not in shell:
            errors.append(f"app shell does not define {key}")
    for key in DESIGN_KEYS:
        if key not in access:
            errors.append(f"access adapter does not recognize design app {key}")
    for key in PDF_KEYS:
        if key not in access:
            errors.append(f"access adapter does not recognize PDF app {key}")

    if "products:['cover']" not in design_core:
        errors.append("cover-only design modules are not product scoped")
    if "app==='layout'" not in pdf_boundary or "app==='booklet'" not in pdf_boundary:
        errors.append("PDF layout/booklet boundary is incomplete")
    if '"apps",' not in hosting:
        errors.append("Hosting allowlist does not include apps directory")
    if "ProgramAccess.guardTool" not in access:
        errors.append("modular apps must reuse ProgramAccess.guardTool")
    if "startAfterAccess" not in shell:
        errors.append("modular app engine must start after access approval")

    # Keep standalone shells thin: app shell must route to canonical editors,
    # never grow a second canvas/PDF implementation.
    if not re.search(r"/design-editor/general\?", shell):
        errors.append("design apps are not routed to the canonical design editor")
    if "/pdf-editor/?embed=1&app=layout" not in shell or "/pdf-editor/?embed=1&app=booklet" not in shell:
        errors.append("PDF apps are not routed to the canonical PDF editor")

    if errors:
        print("Modular app validation failed:", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        raise SystemExit(1)

    print("Modular app architecture OK: 8 standalone routes share canonical design/PDF engines")


if __name__ == "__main__":
    validate()
