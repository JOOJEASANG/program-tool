#!/usr/bin/env python3
"""Audit repository-side and externally supplied operations readiness signals.

The command never prints secret values. Repository regressions, missing or partial
WIF configuration, and a complete loss of CI authentication fail the run.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMP_PREFIXES = {"pdf_temp/", "preflight_temp/", "pdf_results/"}


def _read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def _record(items: list[dict[str, str]], name: str, status: str, detail: str) -> None:
    items.append({"name": name, "status": status, "detail": detail})


def _validate_lifecycle(items: list[dict[str, str]]) -> bool:
    path = ROOT / "storage-lifecycle.json"
    if not path.exists():
        _record(items, "storage_lifecycle_contract", "FAIL", "storage-lifecycle.json missing")
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        _record(items, "storage_lifecycle_contract", "FAIL", f"invalid JSON: {exc}")
        return False

    rules = data.get("rule") if isinstance(data, dict) else None
    if not isinstance(rules, list):
        _record(items, "storage_lifecycle_contract", "FAIL", "rule[] missing")
        return False

    matched: set[str] = set()
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        action = rule.get("action") or {}
        condition = rule.get("condition") or {}
        if action.get("type") != "Delete" or condition.get("age") != 1:
            continue
        prefixes = condition.get("matchesPrefix") or []
        if isinstance(prefixes, list):
            matched.update(str(value) for value in prefixes)

    missing = sorted(TEMP_PREFIXES - matched)
    if missing:
        _record(
            items,
            "storage_lifecycle_contract",
            "FAIL",
            "1-day Delete rule missing prefixes: " + ", ".join(missing),
        )
        return False

    _record(
        items,
        "storage_lifecycle_contract",
        "PASS",
        "1-day Delete rule covers pdf_temp/, preflight_temp/, pdf_results/",
    )
    return True


def audit() -> tuple[dict[str, object], int]:
    checks: list[dict[str, str]] = []
    hard_failure = False

    hard_failure = not _validate_lifecycle(checks) or hard_failure

    admin_tool = _read("backend/scripts/sync_admin_claims.py")
    admin_ready = all(
        marker in admin_tool
        for marker in ("--apply", "--revoke-missing", "--verify", 'claims["admin"] = True')
    )
    _record(
        checks,
        "admin_claim_migration_tool",
        "PASS" if admin_ready else "FAIL",
        "dry-run/apply/revoke/verify commands available"
        if admin_ready
        else "admin claim migration contract is incomplete",
    )
    hard_failure = (not admin_ready) or hard_failure

    deploy = _read(".github/workflows/firebase-deploy.yml")
    preview = _read(".github/workflows/firebase-preview.yml")
    firebase_ci = _read("scripts/firebase_ci.sh")
    wif_contract = (
        all(
            marker in deploy and marker in preview
            for marker in ("GCP_WORKLOAD_IDENTITY_PROVIDER", "GCP_SERVICE_ACCOUNT", "Google Cloud WIF 인증")
        )
        and "FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}" not in deploy
        and "FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}" not in preview
        and "GOOGLE_APPLICATION_CREDENTIALS" in firebase_ci
        and "unset FIREBASE_TOKEN" in firebase_ci
        and 'exec firebase "$@"' in firebase_ci
        and '--token "$FIREBASE_TOKEN"' not in firebase_ci
    )
    _record(
        checks,
        "wif_repository_contract",
        "PASS" if wif_contract else "FAIL",
        "preview/production require WIF ADC and legacy token fallback is removed"
        if wif_contract
        else "WIF-only workflow contract is incomplete",
    )
    hard_failure = (not wif_contract) or hard_failure

    main_py = _read("backend/main.py")
    runtime_contract = all(
        marker in main_py
        for marker in (
            "memory=options.MemoryOption.GB_4",
            "timeout_sec=600",
            "max_instances=2",
            '@scheduler_fn.on_schedule(schedule="every 1 hours")',
            '@scheduler_fn.on_schedule(schedule="every 24 hours")',
        )
    )
    _record(
        checks,
        "pdf_runtime_capacity_contract",
        "PASS" if runtime_contract else "FAIL",
        "4GB / 600s / max_instances=2 and hourly/daily cleanup schedules present"
        if runtime_contract
        else "PDF runtime or cleanup schedule contract changed",
    )
    hard_failure = (not runtime_contract) or hard_failure

    protected_raw = os.environ.get("MAIN_PROTECTED", "").strip().lower()
    if protected_raw == "true":
        _record(checks, "github_main_protection", "PASS", "main branch reports protected=true")
    elif protected_raw == "false":
        _record(checks, "github_main_protection", "WARN", "main branch is not protected")
    else:
        _record(checks, "github_main_protection", "WARN", "main protection status unavailable")

    provider = bool(os.environ.get("GCP_WORKLOAD_IDENTITY_PROVIDER", "").strip())
    service_account = bool(os.environ.get("GCP_SERVICE_ACCOUNT", "").strip())
    if provider != service_account:
        _record(
            checks,
            "wif_secret_pair",
            "FAIL",
            "configure both GCP_WORKLOAD_IDENTITY_PROVIDER and GCP_SERVICE_ACCOUNT together",
        )
        hard_failure = True
    elif provider and service_account:
        _record(checks, "wif_secret_pair", "PASS", "both WIF secrets are configured")
    else:
        _record(checks, "wif_secret_pair", "FAIL", "WIF secrets are not configured")
        hard_failure = True

    if provider and service_account:
        _record(
            checks,
            "firebase_ci_authentication",
            "PASS",
            "WIF is the required Firebase CI authentication path",
        )
    else:
        _record(
            checks,
            "firebase_ci_authentication",
            "FAIL",
            "WIF authentication is not fully configured",
        )
        hard_failure = True

    warning_count = sum(item["status"] == "WARN" for item in checks)
    failure_count = sum(item["status"] == "FAIL" for item in checks)
    report: dict[str, object] = {
        "overall": "FAIL" if hard_failure else ("WARN" if warning_count else "PASS"),
        "checks": checks,
        "failure_count": failure_count,
        "warning_count": warning_count,
        "secrets_redacted": True,
    }
    return report, 1 if hard_failure else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Program Studio operations readiness")
    parser.add_argument("--json-out", help="Optional JSON report output path")
    args = parser.parse_args()

    report, exit_code = audit()
    for item in report["checks"]:
        print(f'{item["status"]:4} {item["name"]}: {item["detail"]}')
    print(
        f'OVERALL {report["overall"]} '
        f'(failures={report["failure_count"]}, warnings={report["warning_count"]})'
    )

    if args.json_out:
        output = Path(args.json_out)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
