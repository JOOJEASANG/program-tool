#!/usr/bin/env python3
"""Fail a PR when a user-facing program changes without its matching manual.

The guard is intentionally path based. It cannot decide whether a code diff is
semantically user-visible, so program implementation changes are treated
conservatively: touch the matching manual in the same PR and confirm its content
still matches the UI/behavior. Shared backend paths may intentionally require
more than one program manual.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

RULES = {
    "print-checker": {
        "name": "인쇄물 사전 검토",
        "manual": "js/program-manuals/print-checker.js",
        "prefixes": (
            "print-checker/",
            "js/print-checker/",
            "backend/services/preflight_",
        ),
        "exact": (
            "css/print-checker.css",
            "backend/routers/preflight.py",
        ),
    },
    "smart-print-layout": {
        "name": "스마트 인쇄배치",
        "manual": "js/program-manuals/smart-print-layout.js",
        "prefixes": (
            "smart-print-layout/",
            "js/smart-print-layout/",
            "backend/services/smart_print_layout",
        ),
        "exact": (
            "css/smart-print-layout.css",
            "backend/routers/pdf_smart_layout.py",
            "backend/models/smart_layout_schemas.py",
        ),
    },
    "pdf-editor": {
        "name": "PDF배치",
        "manual": "js/program-manuals/pdf-editor.js",
        "prefixes": (
            "pdf-editor/",
            "js/pdf-editor/",
            "css/pdf-editor",
        ),
        "exact": (
            "backend/routers/pdf.py",
            "backend/models/schemas.py",
            "backend/services/pdf_engine.py",
            "backend/services/pdf_divider_renderer.py",
            "backend/services/pdf_print_marks.py",
            "backend/services/pdf_text_renderer.py",
            "backend/services/pdf_tiling.py",
        ),
    },
    "pdf-editor-advanced": {
        "name": "PDF편집",
        "manual": "js/program-manuals/pdf-editor-advanced.js",
        "prefixes": (
            "pdf-editor-advanced/",
            "js/pdf-editor-advanced/",
            "css/pdf-editor-advanced",
        ),
        "exact": (
            "backend/routers/pdf_advanced.py",
            "backend/services/pdf_advanced_engine.py",
            "backend/models/advanced_schemas.py",
        ),
    },
    "pdf-suite": {
        "name": "PDF 유틸리티",
        "manual": "js/program-manuals/pdf-suite.js",
        "prefixes": (
            "pdf-suite/",
            "pdf-preflight/",
            "js/pdf-suite/",
            "js/pdf-preflight/",
            "backend/routers/pdf_utility",
            "backend/services/pdf_utility",
            "backend/services/preflight_",
        ),
        "exact": (
            "backend/routers/pdf_tools.py",
            "backend/routers/pdf_large_security.py",
            "backend/routers/preflight.py",
            "backend/services/pdf_ops.py",
            "backend/services/pdf_tiling.py",
        ),
    },
}

REQUIRED_MANUAL_FILES = {
    "manuals/index.html",
    "js/program-manuals/catalog.js",
    "js/program-manuals/app.js",
    "css/program-manuals.css",
    *(rule["manual"] for rule in RULES.values()),
}


def run_git(*args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "git 명령에 실패했습니다.")
    return completed.stdout


def changed_files(base: str, head: str) -> set[str]:
    output = run_git("diff", "--name-only", f"{base}...{head}")
    return {line.strip().replace("\\", "/") for line in output.splitlines() if line.strip()}


def rule_matches(path: str, rule: dict) -> bool:
    if path in rule.get("exact", ()):
        return True
    return any(path.startswith(prefix) for prefix in rule.get("prefixes", ()))


def verify_manual_assets() -> list[str]:
    return [path for path in sorted(REQUIRED_MANUAL_FILES) if not (ROOT / path).is_file()]


def check(changed: set[str]) -> list[tuple[str, str, list[str]]]:
    failures: list[tuple[str, str, list[str]]] = []
    for program_id, rule in RULES.items():
        touched_sources = sorted(
            path
            for path in changed
            if path != rule["manual"] and rule_matches(path, rule)
        )
        if not touched_sources:
            continue
        manual = str(rule["manual"])
        if manual not in changed:
            failures.append((program_id, manual, touched_sources))
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", help="PR base commit SHA")
    parser.add_argument("--head", default="HEAD", help="PR head commit SHA")
    parser.add_argument("--verify-only", action="store_true", help="only verify required manual assets exist")
    args = parser.parse_args()

    missing = verify_manual_assets()
    if missing:
        print("MANUAL SYNC FAILED: 필수 설명서 파일이 없습니다.", file=sys.stderr)
        for path in missing:
            print(f"- {path}", file=sys.stderr)
        return 1

    if args.verify_only:
        print(f"MANUAL ASSET CHECK PASSED: {len(REQUIRED_MANUAL_FILES)} file(s)")
        return 0

    if not args.base:
        parser.error("--base is required unless --verify-only is used")

    try:
        changed = changed_files(args.base, args.head)
    except RuntimeError as error:
        print(f"MANUAL SYNC FAILED: {error}", file=sys.stderr)
        return 1

    failures = check(changed)
    if failures:
        print("MANUAL SYNC FAILED", file=sys.stderr)
        print("사용자 프로그램 소스가 변경됐지만 해당 사용설명서가 같은 PR에서 수정되지 않았습니다.", file=sys.stderr)
        for program_id, manual, sources in failures:
            rule = RULES[program_id]
            print(f"\n[{rule['name']}] 설명서 필요: {manual}", file=sys.stderr)
            for source in sources[:12]:
                print(f"  - {source}", file=sys.stderr)
            if len(sources) > 12:
                print(f"  - ... 외 {len(sources) - 12}개", file=sys.stderr)
        print("\n기능과 설명서를 함께 수정한 뒤 다시 푸시하세요. 기준: docs/manuals/README.md", file=sys.stderr)
        return 1

    relevant = sum(
        1
        for path in changed
        if any(rule_matches(path, rule) for rule in RULES.values())
    )
    print(f"MANUAL SYNC PASSED: changed={len(changed)}, program-source={relevant}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
