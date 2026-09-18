import re
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MANUAL_DIR = ROOT / "js" / "program-manuals"
MANUALS = (
    "print-checker.js",
    "ai-design-maker.js",
    "smart-print-layout.js",
    "pdf-editor.js",
    "pdf-editor-advanced.js",
    "pdf-suite.js",
)
POLICY_UPDATED = date.fromisoformat("2026-09-16")
POLICY_NOTICE = "로그인 후 관리자가 승인한 회원만 사용할 수 있습니다. 현재 승인된 회원에게는 일일·월간·프로그램별 사용횟수 제한이 없습니다."


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _manual_updated(source: str) -> date:
    match = re.search(r"updated:\s*'([0-9]{4}-[0-9]{2}-[0-9]{2})'", source)
    assert match, "manual updated date is missing"
    return date.fromisoformat(match.group(1))


def test_all_live_program_manuals_document_approval_only_unlimited_policy():
    for filename in MANUALS:
        source = read(MANUAL_DIR / filename)
        assert _manual_updated(source) >= POLICY_UPDATED, filename
        assert POLICY_NOTICE in source, filename


def test_manual_registry_enforces_policy_for_future_manuals_too():
    catalog = read(MANUAL_DIR / "catalog.js")
    modal = read(MANUAL_DIR / "home-modal.js")

    for marker in (
        "POLICY_UPDATED = '2026-09-16'",
        "ACCESS_POLICY_NOTICE",
        "accessPolicy: 'approved-members-only'",
        "usageLimit: null",
        "before.unshift(ACCESS_POLICY_NOTICE)",
    ):
        assert marker in catalog

    assert "const VERSION = '20260918-1'" in modal
