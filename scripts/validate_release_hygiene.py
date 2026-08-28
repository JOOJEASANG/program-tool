#!/usr/bin/env python3
"""Validate release-level HTML metadata after deployment HTML generation."""

from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from inject_boot_guard import DEPLOY_HTML, FAVICON_MARKER, ROOT

FAVICON = ROOT / "favicon.svg"
EXPECTED_FRAGMENT = f'{FAVICON_MARKER} rel="icon" href="/favicon.svg" type="image/svg+xml"'


def validate() -> None:
    errors: list[str] = []

    if not FAVICON.is_file():
        errors.append("favicon.svg is missing")
    else:
        try:
            root = ET.parse(FAVICON).getroot()
            if not root.tag.endswith("svg"):
                errors.append("favicon.svg root element is not <svg>")
            if "viewBox" not in root.attrib:
                errors.append("favicon.svg is missing a viewBox")
        except ET.ParseError as error:
            errors.append(f"favicon.svg is invalid XML: {error}")

    checked = 0
    for relative in sorted(DEPLOY_HTML):
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"deploy HTML is missing: {relative}")
            continue
        text = path.read_text(encoding="utf-8")
        marker_count = text.count(FAVICON_MARKER)
        if marker_count != 1:
            errors.append(f"{relative}: expected one favicon marker, found {marker_count}")
            continue
        if EXPECTED_FRAGMENT not in text:
            errors.append(f"{relative}: Program Studio favicon link does not match the release contract")
            continue
        checked += 1

    if errors:
        print("Release hygiene validation failed:", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        raise SystemExit(1)

    print(f"Release hygiene OK: {checked} deploy HTML page(s) share /favicon.svg")


if __name__ == "__main__":
    validate()
