#!/usr/bin/env python3
"""Validate release-level HTML metadata and Hosting delivery policy."""

from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from inject_boot_guard import DEPLOY_HTML, FAVICON_MARKER, META_MARKER, PAGE_METADATA, ROOT
from validate_hosting_delivery import validate as validate_hosting_delivery

FAVICON = ROOT / "favicon.svg"
EXPECTED_FAVICON = f'{FAVICON_MARKER} rel="icon" href="/favicon.svg" type="image/svg+xml"'
TITLE_RE = re.compile(r"<title\b[^>]*>.*?</title\s*>", flags=re.IGNORECASE | re.DOTALL)
DESCRIPTION_RE = re.compile(
    r"<meta\b(?=[^>]*\bname\s*=\s*[\"\']description[\"\'])[^>]*>", flags=re.IGNORECASE
)
ROBOTS_RE = re.compile(
    r"<meta\b(?=[^>]*\bname\s*=\s*[\"\']robots[\"\'])[^>]*>", flags=re.IGNORECASE
)


def validate() -> None:
    validate_hosting_delivery()
    errors: list[str] = []

    if set(PAGE_METADATA) != set(DEPLOY_HTML):
        missing = sorted(set(DEPLOY_HTML) - set(PAGE_METADATA))
        extra = sorted(set(PAGE_METADATA) - set(DEPLOY_HTML))
        errors.append(f"metadata contract mismatch; missing={missing}, extra={extra}")

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
        title, description, robots = PAGE_METADATA[relative]

        if text.count(FAVICON_MARKER) != 1 or EXPECTED_FAVICON not in text:
            errors.append(f"{relative}: favicon release contract mismatch")

        titles = TITLE_RE.findall(text)
        descriptions = DESCRIPTION_RE.findall(text)
        robots_tags = ROBOTS_RE.findall(text)
        if len(titles) != 1:
            errors.append(f"{relative}: expected one title, found {len(titles)}")
        if len(descriptions) != 1:
            errors.append(f"{relative}: expected one description meta, found {len(descriptions)}")
        if len(robots_tags) != 1:
            errors.append(f"{relative}: expected one robots meta, found {len(robots_tags)}")

        expected_title = f'<title {META_MARKER}="title">{title}</title>'
        expected_description = (
            f'<meta {META_MARKER}="description" name="description" content="{description}">'
        )
        expected_robots = f'<meta {META_MARKER}="robots" name="robots" content="{robots}">'
        if expected_title not in text:
            errors.append(f"{relative}: title does not match route metadata contract")
        if expected_description not in text:
            errors.append(f"{relative}: description does not match route metadata contract")
        if expected_robots not in text:
            errors.append(f"{relative}: robots does not match route metadata contract")
        checked += 1

    if errors:
        print("Release hygiene validation failed:", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        raise SystemExit(1)

    print(
        f"Release hygiene OK: {checked} deploy HTML page(s) share /favicon.svg "
        "and normalized title/description/robots metadata"
    )


if __name__ == "__main__":
    validate()
