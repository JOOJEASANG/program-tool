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
        "js/design-editor/shared/module-profile.js",
        "js/design-editor/shared/document-type-state.js",
        "js/design-editor/shared/selection-contextbar.js",
        "js/design-editor/shared/multi-selection-context.js",
        "js/design-editor/shared/workspace-navigation.js",
        "js/design-editor/standalone-product-profile.js",
        "js/design-editor/product-boundary-ui.js",
        "js/pdf-editor/standalone-app-profile.js",
        "js/pdf-editor/app-boundary.js",
        "tests/browser/modular-app-shell-smoke.html",
        "tests/browser/standalone-product-profile-smoke.html",
        "tests/browser/standalone-boundary-ui-smoke.html",
        "tests/browser/design-workspace-navigation-smoke.html",
        "tests/browser/design-multi-selection-shared-smoke.html",
        "scripts/run_modular_app_shell_smoke.sh",
    )
    for relative in required:
        if not (ROOT / relative).is_file():
            errors.append(f"missing modular app asset: {relative}")

    legacy_removed = (
        "js/design-editor/multi-selection-context.js",
    )
    for relative in legacy_removed:
        if (ROOT / relative).exists():
            errors.append(f"legacy design asset must stay removed after shared migration: {relative}")

    firebase = json.loads(read("firebase.json"))
    rewrites = firebase.get("hosting", {}).get("rewrites", [])
    if not any(rule.get("source") == "/apps/**" and rule.get("destination") == "/apps/index.html" for rule in rewrites):
        errors.append("Firebase Hosting /apps/** rewrite is missing")

    shell = read("js/studio-app-shell.js")
    access = read("js/modular-app-access.js")
    home = read("js/home-program-catalog.js")
    design_core = read("js/design-editor/core-runtime.js")
    design_shell = read("js/design-editor/shell-runtime.js")
    shared_modules = read("js/design-editor/shared/module-profile.js")
    workspace_nav = read("js/design-editor/shared/workspace-navigation.js")
    design_profiles = read("js/design-editor/standalone-product-profile.js")
    boundary_ui = read("js/design-editor/product-boundary-ui.js")
    pdf_route = read("js/pdf-editor/route-runtime.js")
    pdf_profiles = read("js/pdf-editor/standalone-app-profile.js")
    pdf_boundary = read("js/pdf-editor/app-boundary.js")
    hosting = read("scripts/prepare_hosting_dist.py")
    browser_smoke = read("tests/browser/modular-app-shell-smoke.html")
    profile_smoke = read("tests/browser/standalone-product-profile-smoke.html")
    boundary_smoke = read("tests/browser/standalone-boundary-ui-smoke.html")
    workspace_nav_smoke = read("tests/browser/design-workspace-navigation-smoke.html")
    multi_selection_smoke = read("tests/browser/design-multi-selection-shared-smoke.html")
    smoke_runner = read("scripts/run_modular_app_shell_smoke.sh")

    for key in APP_KEYS:
        if f"/apps/{key}" not in home:
            errors.append(f"home catalog does not expose /apps/{key}")
        if key not in shell:
            errors.append(f"app shell does not define {key}")
        if key not in browser_smoke:
            errors.append(f"browser smoke does not define {key}")
        if key not in smoke_runner:
            errors.append(f"browser smoke runner does not execute {key}")
    for key in DESIGN_KEYS:
        if key not in access:
            errors.append(f"access adapter does not recognize design app {key}")
        if f"{key}:Object.freeze(" not in design_profiles:
            errors.append(f"standalone product profile is missing {key}")
    for key in PDF_KEYS:
        if key not in access:
            errors.append(f"access adapter does not recognize PDF app {key}")
    for key in ("layout", "booklet"):
        if f"{key}:Object.freeze(" not in pdf_profiles:
            errors.append(f"standalone PDF profile is missing {key}")

    if (
        "const COVER_ONLY_IDS=new Set([" not in design_core
        or "designEditorCoverModelScriptV1" not in design_core
        or "return product==='cover'" not in design_core
    ):
        errors.append("cover-only design modules are not product scoped")
    if "shared/module-profile.js" not in design_core or "shouldLoadCore" not in design_core:
        errors.append("design core does not consume the shared module policy layer")
    if "shared/module-profile.js" not in design_shell or "shouldLoadShell" not in design_shell:
        errors.append("design shell does not consume the shared module policy layer")
    if "shared/document-type-state.js?v=20260831-1" not in design_shell:
        errors.append("design shell does not load canonical document type state from shared")
    if "shared/selection-contextbar.js?v=20260831-1" not in design_shell:
        errors.append("design shell does not load selection contextbar from shared")
    if "shared/multi-selection-context.js?v=20260828-1" not in design_shell:
        errors.append("design shell does not load multi-selection context from shared")
    if "shared/workspace-navigation.js?v=20260831-1" not in design_shell or "loadWorkspaceNavigation" not in design_shell:
        errors.append("standalone design shell does not load shared workspace navigation")
    if (
        "design-editor-shared-module-profile-v1" not in shared_modules
        or "CORE_PRODUCT_ONLY" not in shared_modules
        or "SHELL_CAPABILITIES" not in shared_modules
    ):
        errors.append("shared design module policy is incomplete")
    if (
        "shared-workspace-navigation-v1" not in workspace_nav
        or "{key:'start',label:'설정'}" not in workspace_nav
        or "{key:'edit',label:'편집'}" not in workspace_nav
        or "{key:'arrange',label:'배치'}" not in workspace_nav
        or "{key:'output',label:'출력'}" not in workspace_nav
        or "DesignEditorEssentialWorkspace" not in workspace_nav
    ):
        errors.append("shared design workspace navigation is incomplete")
    if "standalone-product-profile.js" not in design_shell or "activeProfile" not in design_shell:
        errors.append("design shell does not use the standalone product profile layer")
    if "DesignEditorStandaloneProducts" not in boundary_ui:
        errors.append("product-boundary UI does not consume standalone product profiles")
    if "standalone-app-profile.js" not in pdf_route or "loadStandaloneBoundary" not in pdf_route:
        errors.append("PDF route does not load standalone app profiles outside the canonical manifest")
    if "PdfEditorStandaloneApps" not in pdf_boundary:
        errors.append("PDF app boundary does not consume standalone PDF profiles")
    if "app!=='layout'&&app!=='booklet'" not in pdf_boundary or "if(app==='layout')" not in pdf_boundary:
        errors.append("PDF layout/booklet boundary is incomplete")
    if '"apps",' not in hosting:
        errors.append("Hosting allowlist does not include apps directory")
    if "ProgramAccess.guardTool" not in access:
        errors.append("modular apps must reuse ProgramAccess.guardTool")
    if "startAfterAccess" not in shell:
        errors.append("modular app engine must start after access approval")
    if "engine started before approval" not in browser_smoke:
        errors.append("browser smoke does not verify approval-before-engine contract")
    if (
        "data-standalone-profile-smoke" not in profile_smoke
        or "standalone-product-profile-smoke.html" not in smoke_runner
        or "DesignEditorSharedModuleProfile" not in profile_smoke
    ):
        errors.append("standalone/shared design/PDF profile browser coverage is missing")
    if "data-standalone-boundary-smoke" not in boundary_smoke or "standalone-boundary-ui-smoke.html" not in smoke_runner:
        errors.append("standalone boundary UI browser coverage is missing")
    if (
        "dataset.workspaceNavSmoke" not in workspace_nav_smoke
        or "dataset.workspaceNavSteps" not in workspace_nav_smoke
        or "dataset.workspaceNavProduct" not in workspace_nav_smoke
        or "design-workspace-navigation-smoke.html" not in smoke_runner
    ):
        errors.append("shared design workspace navigation browser coverage is missing")
    if (
        "shared/multi-selection-context.js" not in multi_selection_smoke
        or "dataset.multiSelectionSharedSmoke" not in multi_selection_smoke
        or "dataset.multiSelectionSharedOwnership" not in multi_selection_smoke
        or "design-multi-selection-shared-smoke.html" not in smoke_runner
    ):
        errors.append("shared multi-selection browser/UI ownership coverage is missing")

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

    print("Modular app architecture OK: 8 standalone routes share canonical design/PDF engines, shared module policy, shared editor state/UI, product profiles, boundary UI, workspace navigation, multi-selection context and browser coverage")


if __name__ == "__main__":
    validate()
