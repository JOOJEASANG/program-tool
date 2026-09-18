#!/usr/bin/env python3
"""Read-only verification of external Firebase/Google Cloud operations state.

Requires ADC/WIF credentials. This command never changes Storage lifecycle rules,
Firebase Auth custom claims, Firestore documents, or any other cloud resource.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

REQUIRED_PREFIXES = {"pdf_temp/", "preflight_temp/", "pdf_results/"}


def evaluate_lifecycle_payload(payload: dict[str, Any]) -> tuple[bool, str]:
    rules = ((payload or {}).get("lifecycle") or {}).get("rule") or []
    matched: set[str] = set()
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        action = rule.get("action") or {}
        condition = rule.get("condition") or {}
        if action.get("type") != "Delete" or int(condition.get("age") or 0) != 1:
            continue
        prefixes = condition.get("matchesPrefix") or []
        if isinstance(prefixes, list):
            matched.update(str(value) for value in prefixes)
    missing = sorted(REQUIRED_PREFIXES - matched)
    if missing:
        return False, "missing 1-day Delete prefixes: " + ", ".join(missing)
    return True, "actual bucket lifecycle covers all required 1-day temp prefixes"


def _record(checks: list[dict[str, Any]], name: str, status: str, detail: str, **extra: Any) -> None:
    item: dict[str, Any] = {"name": name, "status": status, "detail": detail}
    item.update(extra)
    checks.append(item)


def audit_cloud_state(bucket_name: str) -> tuple[dict[str, Any], int]:
    checks: list[dict[str, Any]] = []
    try:
        import firebase_admin
        from firebase_admin import auth, firestore, storage
    except ImportError as exc:
        _record(
            checks,
            "cloud_dependencies",
            "ERROR",
            "firebase-admin/google-cloud-storage dependencies are unavailable",
            error_type=type(exc).__name__,
        )
        return {
            "overall": "ERROR",
            "checks": checks,
            "secrets_redacted": True,
        }, 1

    try:
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app(options={"storageBucket": bucket_name})
    except Exception as exc:
        _record(
            checks,
            "firebase_adc",
            "ERROR",
            "Firebase Admin could not initialize with ADC/WIF credentials",
            error_type=type(exc).__name__,
        )
        return {
            "overall": "ERROR",
            "checks": checks,
            "secrets_redacted": True,
        }, 1

    try:
        bucket = storage.bucket(bucket_name)
        bucket.reload()
        ok, detail = evaluate_lifecycle_payload(dict(getattr(bucket, "_properties", {}) or {}))
        _record(checks, "actual_storage_lifecycle", "PASS" if ok else "FAIL", detail)
    except Exception as exc:
        _record(
            checks,
            "actual_storage_lifecycle",
            "ERROR",
            "actual bucket lifecycle could not be read",
            error_type=type(exc).__name__,
        )

    try:
        snapshot = firestore.client().collection("settings").document("admin").get()
        data = snapshot.to_dict() if snapshot.exists else {}
        emails = (data or {}).get("emails")
        configured = sorted(
            {
                value.strip().lower()
                for value in (emails if isinstance(emails, list) else [])
                if isinstance(value, str) and value.strip()
            }
        )
        if not configured:
            _record(
                checks,
                "actual_admin_claims",
                "FAIL",
                "settings/admin contains no administrator emails",
                configured_count=0,
                missing_user_count=0,
                missing_claim_count=0,
            )
        else:
            missing_user = 0
            missing_claim = 0
            for email in configured:
                try:
                    user = auth.get_user_by_email(email)
                except auth.UserNotFoundError:
                    missing_user += 1
                    continue
                if (user.custom_claims or {}).get("admin") is not True:
                    missing_claim += 1
            ok = missing_user == 0 and missing_claim == 0
            _record(
                checks,
                "actual_admin_claims",
                "PASS" if ok else "FAIL",
                "all configured administrators have admin=true"
                if ok
                else "one or more configured administrators are not claim-ready",
                configured_count=len(configured),
                missing_user_count=missing_user,
                missing_claim_count=missing_claim,
            )
    except Exception as exc:
        _record(
            checks,
            "actual_admin_claims",
            "ERROR",
            "administrator claim state could not be read",
            error_type=type(exc).__name__,
        )

    statuses = {str(item["status"]) for item in checks}
    overall = "ERROR" if "ERROR" in statuses else ("FAIL" if "FAIL" in statuses else "PASS")
    report = {
        "overall": overall,
        "bucket": bucket_name,
        "checks": checks,
        "secrets_redacted": True,
        "mutations_performed": False,
    }
    return report, 0 if overall == "PASS" else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only cloud operations state audit")
    parser.add_argument(
        "--bucket",
        default="program-tool.firebasestorage.app",
        help="Firebase Storage bucket name",
    )
    parser.add_argument("--json-out", help="Optional JSON report output path")
    args = parser.parse_args()

    report, exit_code = audit_cloud_state(args.bucket)
    for item in report["checks"]:
        counts = [
            f"{key}={value}"
            for key, value in item.items()
            if key.endswith("_count")
        ]
        suffix = f" ({', '.join(counts)})" if counts else ""
        print(f'{item["status"]:5} {item["name"]}: {item["detail"]}{suffix}')
    print(f'OVERALL {report["overall"]}; mutations_performed=false')

    if args.json_out:
        path = Path(args.json_out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
