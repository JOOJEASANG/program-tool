#!/usr/bin/env python3
"""Validate Program Studio's public manual center and program/manual mapping."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PROGRAMS = {
    "print-checker": "js/program-manuals/print-checker.js",
    "smart-print-layout": "js/program-manuals/smart-print-layout.js",
    "pdf-editor": "js/program-manuals/pdf-editor.js",
    "pdf-editor-advanced": "js/program-manuals/pdf-editor-advanced.js",
    "pdf-suite": "js/program-manuals/pdf-suite.js",
}

GUIDE_ASSETS = (
    "css/program-manuals.css",
    "js/program-manuals/catalog.js",
    *PROGRAMS.values(),
    "js/program-manuals/app.js",
)

REQUIRED_MANUAL_KEYS = (
    "summary:",
    "audience:",
    "before:",
    "quickStart:",
    "sections:",
    "demo:",
    "troubleshooting:",
    "glossary:",
)

CONTEXT_ROUTES = (
    "print-checker/index.html",
    "smart-print-layout/index.html",
    "pdf-editor/index.html",
    "pdf-editor-advanced/index.html",
    "pdf-suite/index.html",
    "pdf-preflight/index.html",
)


def read(relative: str) -> str:
    path = ROOT / relative
    if not path.is_file():
        raise AssertionError(f"필수 파일이 없습니다: {relative}")
    return path.read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def validate_guide() -> None:
    guide = read("guide.html")
    require('id="programList"' in guide, "guide.html에 프로그램 목록이 없습니다.")
    require('data-tab="quick"' in guide, "guide.html에 빠른 시작 탭이 없습니다.")
    require('data-tab="details"' in guide, "guide.html에 상세 기능 탭이 없습니다.")
    require('data-tab="demo"' in guide, "guide.html에 자동 시연 탭이 없습니다.")
    require('data-tab="trouble"' in guide, "guide.html에 문제 해결 탭이 없습니다.")
    for asset in GUIDE_ASSETS:
        require(f"/{asset}" in guide, f"guide.html이 설명서 자산을 로드하지 않습니다: {asset}")


def validate_catalog() -> None:
    catalog = read("js/program-manuals/catalog.js")
    for program_id in PROGRAMS:
        require(f"'{program_id}'" in catalog, f"설명서 catalog에 프로그램이 없습니다: {program_id}")


def validate_manual(program_id: str, relative: str) -> None:
    text = read(relative)
    require(f"id: '{program_id}'" in text, f"{relative}의 id가 {program_id}와 일치하지 않습니다.")
    updated = re.search(r"updated:\s*'([^']+)'", text)
    require(updated is not None, f"{relative}에 updated 날짜가 없습니다.")
    require(bool(re.fullmatch(r"20\d{2}-\d{2}-\d{2}", updated.group(1))), f"{relative}의 updated 날짜 형식이 올바르지 않습니다.")
    for key in REQUIRED_MANUAL_KEYS:
        require(key in text, f"{relative}에 필수 설명서 섹션이 없습니다: {key[:-1]}")
    quick_count = len(re.findall(r"\{\s*title:\s*'[^']+'\s*,\s*text:", text))
    require(quick_count >= 5, f"{relative}의 단계 설명이 너무 적습니다: {quick_count}")
    require("scene:" in text, f"{relative}에 자동 시연 scene이 없습니다.")
    require("q:" in text and "a:" in text, f"{relative}에 문제 해결 Q&A가 없습니다.")


def validate_context_links() -> None:
    injection = read("scripts/inject_boot_guard.py")
    context_js = read("js/program-manuals/context-link.js")
    require("MANUAL_CONTEXT_HTML" in injection, "배포 주입기에 설명서 문맥 링크 계약이 없습니다.")
    require("data-program-manual-context" in injection, "배포 주입기에 설명서 링크 마커가 없습니다.")
    for route in CONTEXT_ROUTES:
        require(f'"{route}"' in injection, f"설명서 문맥 링크 대상에서 빠진 화면이 있습니다: {route}")
    for program_id in PROGRAMS:
        require(f"'{program_id}'" in context_js, f"문맥형 설명서 링크에서 프로그램 매핑이 빠졌습니다: {program_id}")
    require("/guide.html?program=" in context_js, "문맥형 설명서 링크가 프로그램 딥링크를 사용하지 않습니다.")


def validate_home_links() -> None:
    launcher = read("js/pdf-suite-home-launcher.js")
    require("installManualEntry" in launcher, "홈에 사용설명서 진입점이 없습니다.")
    require("href='/guide.html'" in launcher or "href=\'/guide.html\'" in launcher or "link.href='/guide.html'" in launcher, "홈 사용설명서 링크가 없습니다.")
    for program_id in PROGRAMS:
        require(f"manualUrl:'guide.html?program={program_id}'" in launcher, f"홈 프로그램 설명서 딥링크가 없습니다: {program_id}")


def validate_maintenance_contract() -> None:
    for path in (
        "AGENTS.md",
        "CLAUDE.md",
        ".github/copilot-instructions.md",
        "docs/manuals/README.md",
        ".github/workflows/manual-sync.yml",
        "scripts/check_manual_sync.py",
    ):
        read(path)
    agents = read("AGENTS.md")
    copilot = read(".github/copilot-instructions.md")
    claude = read("CLAUDE.md")
    for program_id, manual in PROGRAMS.items():
        del program_id
        require(manual in agents, f"AGENTS.md에 설명서 매핑이 없습니다: {manual}")
        require(manual in copilot, f"Copilot 지침에 설명서 매핑이 없습니다: {manual}")
        require(manual in claude, f"CLAUDE.md에 설명서 매핑이 없습니다: {manual}")


def main() -> int:
    try:
        validate_guide()
        validate_catalog()
        for program_id, relative in PROGRAMS.items():
            validate_manual(program_id, relative)
        validate_context_links()
        validate_home_links()
        validate_maintenance_contract()
    except AssertionError as error:
        print(f"PROGRAM MANUAL VALIDATION FAILED: {error}", file=sys.stderr)
        return 1
    print(f"PROGRAM MANUAL VALIDATION PASSED: {len(PROGRAMS)} manuals + animated guide + sync guard")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
