#!/usr/bin/env python3
"""Validate the standalone app routes and product boundaries."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PDF_KEYS = {"pdf-layout", "booklet"}
PRINT_CHECKER_PRODUCTS = ("cover", "leaflet", "flyer", "invitation")


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def validate() -> None:
    errors: list[str] = []

    required = (
        "apps/index.html",
        "css/studio-app-shell.css",
        "css/print-checker.css",
        "js/studio-app-shell.js",
        "js/modular-app-access.js",
        "js/pdf-editor/standalone-app-profile.js",
        "js/pdf-editor/app-boundary.js",
        "js/pdf-editor/route-runtime.js",
        "print-checker/index.html",
        "js/print-checker/access.js",
        "js/print-checker/print-checker.js",
        "pdf-editor-advanced/index.html",
        "css/pdf-editor-advanced.css",
        "js/pdf-editor-advanced/app.js",
        "js/pdf-editor-advanced/state.js",
        "js/pdf-editor-advanced/preview.js",
        "js/pdf-editor-advanced/api.js",
        "tests/browser/modular-app-shell-smoke.html",
        "tests/browser/standalone-boundary-ui-smoke.html",
        "tests/browser/print-checker-smoke.html",
        "tests/browser/pdf-advanced-sidebar-hard-isolation-smoke.html",
        "scripts/run_modular_app_shell_smoke.sh",
    )
    for relative in required:
        if not (ROOT / relative).is_file():
            errors.append(f"missing asset: {relative}")

    # Design editor must be gone — print checker replaced it
    design_editor_remnants = (
        "js/design-editor/core-runtime.js",
        "js/design-editor/shell-runtime.js",
        "js/design-editor/app.js",
    )
    for relative in design_editor_remnants:
        if (ROOT / relative).exists():
            errors.append(f"design-editor asset must be removed: {relative}")

    firebase = json.loads(read("firebase.json"))
    rewrites = firebase.get("hosting", {}).get("rewrites", [])
    if not any(
        rule.get("source") == "/apps/**" and rule.get("destination") == "/apps/index.html"
        for rule in rewrites
    ):
        errors.append("Firebase Hosting /apps/** rewrite is missing")
    if not any(
        rule.get("source") == "/print-checker" and rule.get("destination") == "/print-checker/index.html"
        for rule in rewrites
    ):
        errors.append("Firebase Hosting /print-checker rewrite is missing")
    if not any(
        rule.get("source") == "/pdf-editor-advanced"
        and rule.get("destination") == "/pdf-editor-advanced/index.html"
        for rule in rewrites
    ):
        errors.append("Firebase Hosting standalone /pdf-editor-advanced rewrite is missing")

    apps_html = read("apps/index.html")
    if "/print-checker?product=" not in apps_html:
        errors.append("apps/index.html does not redirect to /print-checker?product=")
    if "design-editor/general" in apps_html:
        errors.append("apps/index.html must not reference design-editor/general")

    checker_html = read("print-checker/index.html")
    for marker in ("productGrid", "uploadZone", "specForm", "reportSection", "previewCanvas"):
        if marker not in checker_html:
            errors.append(f"print-checker/index.html is missing element: {marker}")

    checker_css = read("css/print-checker.css")
    if "/css/print-checker.css" not in checker_html:
        errors.append("print-checker/index.html does not load the scoped print-checker stylesheet")
    for cls in ("status-pass", "status-warn", "status-fail", "status-info"):
        if cls not in checker_css:
            errors.append(f"css/print-checker.css is missing status class: {cls}")

    checker_js = read("js/print-checker/print-checker.js")
    for product in PRINT_CHECKER_PRODUCTS:
        if product not in checker_js:
            errors.append(f"print-checker.js does not handle product type: {product}")
    for fn in ("checkBleed", "checkSafeZone", "checkSpine", "checkFold", "drawCanvas", "drawRect", "drawLegend", "renderReport"):
        if fn not in checker_js:
            errors.append(f"print-checker.js is missing function: {fn}")
    for fold in ("2fold", "3roll", "3zfold", "4fold"):
        if fold not in checker_js:
            errors.append(f"print-checker.js does not handle fold type: {fold}")

    checker_access = read("js/print-checker/access.js")
    if "ProgramAccess.guardTool" in checker_access or "approval-waiting" in checker_access:
        errors.append("print-checker must remain a public daily-free route, not an approval-gated tool")
    if (
        "daily-free" not in checker_access
        or "ProgramPdfDailyFree?.guestLimit" not in checker_access
        or "ProgramPdfDailyFree?.memberLimit" not in checker_access
        or "quota.status()" not in checker_access
    ):
        errors.append("print-checker configurable daily-free access policy is incomplete")
    if "/js/pdf-daily-free.js" not in checker_html:
        errors.append("print-checker/index.html must load the shared daily-free runtime")

    access = read("js/modular-app-access.js")
    for key in PDF_KEYS:
        if key not in access:
            errors.append(f"access adapter does not recognize PDF app: {key}")
    if "ProgramAccess.guardTool" not in access:
        errors.append("modular PDF apps must reuse ProgramAccess.guardTool")

    pdf_profiles = read("js/pdf-editor/standalone-app-profile.js")
    for key in ("layout", "booklet"):
        if f"{key}:Object.freeze(" not in pdf_profiles:
            errors.append(f"standalone PDF profile is missing: {key}")

    pdf_boundary = read("js/pdf-editor/app-boundary.js")
    if "PdfEditorStandaloneApps" not in pdf_boundary:
        errors.append("PDF app boundary does not consume standalone PDF profiles")
    if "app!=='layout'&&app!=='booklet'" not in pdf_boundary or "if(app==='layout')" not in pdf_boundary:
        errors.append("PDF layout/booklet boundary is incomplete")

    pdf_route = read("js/pdf-editor/route-runtime.js")
    if "standalone-app-profile.js" not in pdf_route or "loadStandaloneBoundary" not in pdf_route:
        errors.append("PDF route does not load standalone app profiles outside the canonical manifest")

    shell = read("js/studio-app-shell.js")
    if "startAfterAccess" not in shell:
        errors.append("modular app engine must start after access approval")
    if "/pdf-editor/?embed=1&app=layout" not in shell or "/pdf-editor/?embed=1&app=booklet" not in shell:
        errors.append("PDF apps are not routed to the canonical PDF editor")

    advanced_html = read("pdf-editor-advanced/index.html")
    if 'data-pdf-advanced-standalone="1"' not in advanced_html:
        errors.append("standalone advanced editor marker is missing")
    if "/js/pdf-editor-advanced/app.js" not in advanced_html:
        errors.append("standalone advanced editor entry module is missing")
    for forbidden in (
        "/js/pdf-editor/core-runtime.js",
        "/js/pdf-editor/advanced-runtime.js",
        "advanced-profile-scope",
        "N-up",
        "nup",
        "booklet",
        "소책자",
        "간지",
    ):
        if forbidden in advanced_html:
            errors.append(f"standalone advanced editor leaks legacy layout dependency: {forbidden}")
    for marker in (
        'id="scaleRange"', 'id="offsetXRange"', 'id="offsetYRange"',
        'id="eraseModeBtn"', 'id="marginLeft"', 'id="marginRight"',
        'id="marginTop"', 'id="marginBottom"', 'id="hfEnabled"',
        'id="pnEnabled"', 'id="downloadBtn"',
    ):
        if marker not in advanced_html:
            errors.append(f"standalone advanced editor missing required control: {marker}")

    advanced_frontend = "\n".join(
        read(f"js/pdf-editor-advanced/{name}").lower()
        for name in ("app.js", "state.js", "preview.js", "api.js")
    )
    for forbidden in ("nupscale", "nupoffset", "pdfnup", "booklet", "/js/pdf-editor/"):
        if forbidden in advanced_frontend:
            errors.append(f"standalone advanced state/runtime leaks layout dependency: {forbidden}")
    for required_marker in ("edit_scale", "offset_x_mm", "offset_y_mm", "header_footer", "page_numbers", "margins"):
        if required_marker not in advanced_frontend:
            errors.append(f"standalone advanced serialization missing: {required_marker}")

    browser_smoke = read("tests/browser/modular-app-shell-smoke.html")
    if "engine started before approval" not in browser_smoke:
        errors.append("browser smoke does not verify approval-before-engine contract")

    hosting = read("scripts/prepare_hosting_dist.py")
    if '"apps",' not in hosting:
        errors.append("Hosting allowlist does not include apps directory")

    if errors:
        print("Modular app validation failed:", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        raise SystemExit(1)

    print("Modular app architecture OK: public Print Checker, canonical N-up/booklet editor, standalone advanced PDF editor, protected routes, Firebase rewrites and browser smoke coverage all validated")


if __name__ == "__main__":
    validate()
