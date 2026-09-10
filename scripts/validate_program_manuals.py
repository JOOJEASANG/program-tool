#!/usr/bin/env python3
"""Validate Program Studio manuals, home modal entry points, and sync contract."""
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

MANUAL_ASSETS = (
    "css/program-manuals.css",
    "js/program-manuals/catalog.js",
    *PROGRAMS.values(),
    "js/program-manuals/app.js",
)

HOME_MODAL_ASSETS = (
    "css/program-manual-home-modal.css",
    "js/program-manuals/home-modal.js",
)

REQUIRED_MANUAL_KEYS = (
    "summary:",
    "audience:",
    "before:",
    "quickStart:",
    "sections:",
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


def validate_manual_center() -> None:
    page = read("manuals/index.html")
    require('id="programList"' in page, "manuals/index.html에 프로그램 목록이 없습니다.")
    require('id="manualBody"' in page, "manuals/index.html에 상세설명서 본문이 없습니다.")
    require("자동 시연" not in page, "manuals/index.html에 삭제된 자동 시연 UI가 남아 있습니다.")
    require('data-tab="demo"' not in page and 'id="demoPanel"' not in page, "자동 시연 탭 또는 패널이 남아 있습니다.")
    for asset in MANUAL_ASSETS:
        require(f"/{asset}" in page, f"manuals/index.html이 설명서 자산을 로드하지 않습니다: {asset}")


def validate_legacy_guide() -> None:
    guide = read("guide.html")
    require("<h1>이용안내</h1>" in guide, "기존 이용안내 내용이 보존되지 않았습니다.")
    require("1. 가입과 승인" in guide, "기존 가입·승인 안내가 보존되지 않았습니다.")
    require("3. 구독 등급" in guide, "기존 구독 안내가 보존되지 않았습니다.")
    require('src="js/business-info-loader.js"' in guide, "guide.html의 기존 사업자 정보 로더 연결이 없습니다.")
    require("ProgramBusinessInfo.render(" in guide, "guide.html이 사업자 정보를 안전한 공통 렌더러로 표시하지 않습니다.")
    require('id="programList"' not in guide, "기존 이용안내와 프로그램 설명서 센터가 같은 URL을 공유하고 있습니다.")


def validate_catalog() -> None:
    catalog = read("js/program-manuals/catalog.js")
    for program_id in PROGRAMS:
        require(f"'{program_id}'" in catalog, f"설명서 catalog에 프로그램이 없습니다: {program_id}")


def quick_start_block(text: str) -> str:
    match = re.search(r"quickStart:\s*\[(.*?)\]\s*,\s*sections:\s*\[", text, flags=re.DOTALL)
    if not match:
        raise AssertionError("quickStart 배열 범위를 찾지 못했습니다.")
    return match.group(1)


def validate_manual(program_id: str, relative: str) -> None:
    text = read(relative)
    require(f"id: '{program_id}'" in text, f"{relative}의 id가 {program_id}와 일치하지 않습니다.")
    updated = re.search(r"updated:\s*'([^']+)'", text)
    require(updated is not None, f"{relative}에 updated 날짜가 없습니다.")
    require(bool(re.fullmatch(r"20\d{2}-\d{2}-\d{2}", updated.group(1))), f"{relative}의 updated 날짜 형식이 올바르지 않습니다.")
    for key in REQUIRED_MANUAL_KEYS:
        require(key in text, f"{relative}에 필수 설명서 섹션이 없습니다: {key[:-1]}")
    quick = quick_start_block(text)
    quick_count = len(re.findall(r"\{\s*title:\s*'[^']+'\s*,\s*text:", quick))
    require(quick_count >= 5, f"{relative}의 사용 순서 단계가 너무 적습니다: {quick_count}")
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
    require("/manuals/?program=" in context_js, "문맥형 설명서 링크가 전용 설명서 딥링크를 사용하지 않습니다.")


def validate_home_modal() -> None:
    launcher = read("js/pdf-suite-home-launcher.js")
    for asset in HOME_MODAL_ASSETS:
        read(asset)
    require("installCardManualButtons" in launcher, "홈 프로그램 카드에 사용설명서 버튼 설치 코드가 없습니다.")
    require("data-manual-program" in launcher or "dataset.manualProgram" in launcher, "프로그램별 설명서 버튼 식별자가 없습니다.")
    require("ensureManualModal" in launcher, "설명서 레이어 지연 로더가 없습니다.")
    require("home-modal.js" in launcher, "홈이 설명서 레이어 모듈을 로드하지 않습니다.")
    require("program-manual-home-modal.css" in launcher, "홈이 설명서 레이어 스타일을 로드하지 않습니다.")
    require("programManualTopLink" in launcher and "removeStandaloneManualEntries" in launcher, "기존 전역 설명서 진입점 정리가 없습니다.")
    modal = read("js/program-manuals/home-modal.js")
    require("renderDetails" in modal and "renderTrouble" in modal, "레이어 상세설명서 렌더링이 불완전합니다.")
    require("renderDemo" not in modal and "자동 시연" not in modal, "홈 설명서 레이어에 자동 시연 코드가 남아 있습니다.")


def validate_hosting_contract() -> None:
    hosting = read("scripts/prepare_hosting_dist.py")
    require('"manuals"' in hosting, "Firebase Hosting allowlist에 manuals 디렉터리가 없습니다.")


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
    for manual in PROGRAMS.values():
        require(manual in agents, f"AGENTS.md에 설명서 매핑이 없습니다: {manual}")
        require(manual in copilot, f"Copilot 지침에 설명서 매핑이 없습니다: {manual}")
        require(manual in claude, f"CLAUDE.md에 설명서 매핑이 없습니다: {manual}")


def main() -> int:
    try:
        validate_manual_center()
        validate_legacy_guide()
        validate_catalog()
        for program_id, relative in PROGRAMS.items():
            validate_manual(program_id, relative)
        validate_context_links()
        validate_home_modal()
        validate_hosting_contract()
        validate_maintenance_contract()
    except AssertionError as error:
        print(f"PROGRAM MANUAL VALIDATION FAILED: {error}", file=sys.stderr)
        return 1
    print(f"PROGRAM MANUAL VALIDATION PASSED: {len(PROGRAMS)} detailed manuals + home modal + sync guard")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
