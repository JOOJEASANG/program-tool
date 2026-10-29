#!/usr/bin/env python3
"""Apply the 24-hour lifecycle policy only to unsaved temporary Storage objects.

The bucket may have unrelated lifecycle policies. Never replace them, and never
add a broad unprefixed Delete rule that could erase saved user projects.
Credentials come from the deployment workload identity (ADC).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RETENTION_DAYS = 1
TEMP_PREFIXES = ("pdf_temp/", "preflight_temp/", "pdf_results/")


def required_prefixes(config_path: Path = ROOT / "storage-lifecycle.json") -> tuple[str, ...]:
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    rules = payload.get("rule", [])
    if len(rules) != 1:
        raise ValueError("Temporary lifecycle must contain exactly one scoped rule")
    rule = rules[0]
    condition = rule.get("condition") or {}
    prefixes = condition.get("matchesPrefix")
    if (rule.get("action", {}).get("type") != "Delete"
        or condition.get("age") != RETENTION_DAYS
        or not isinstance(prefixes, list)
        or set(prefixes) != set(TEMP_PREFIXES)
        or len(prefixes) != len(TEMP_PREFIXES)):
        raise ValueError("Temporary lifecycle must delete only three known prefixes after one day")
    return tuple(prefixes)


def _matching_rule(rule: dict, prefixes: tuple[str, ...]) -> bool:
    action = rule.get("action") or {}
    condition = rule.get("condition") or {}
    existing = condition.get("matchesPrefix") or []
    return (action.get("type") == "Delete"
            and condition.get("age") == RETENTION_DAYS
            and isinstance(existing, list)
            and set(prefixes) == set(existing)
            and set(condition) == {"age", "matchesPrefix"})


def _unsafe_overlap(rule: dict, prefixes: tuple[str, ...]) -> bool:
    """Reject overlapping early/blanket deletion instead of misreporting retention."""
    if (rule.get("action") or {}).get("type") != "Delete":
        return False
    condition = rule.get("condition") or {}
    matches_prefix = condition.get("matchesPrefix") or []
    if not isinstance(matches_prefix, list):
        return True
    if not matches_prefix:
        return True  # Bucket-wide deletion cannot guarantee saved-work safety.
    if not any(
        a.startswith(b) or b.startswith(a)
        for a in matches_prefix for b in prefixes
    ):
        return False
    # Any other overlapping lifecycle rule can have a shorter TTL or a
    # condition independent of age (e.g. createdBefore); review it first.
    return not _matching_rule(rule, prefixes)


def ensure_temporary_retention(bucket, prefixes: tuple[str, ...]) -> bool:
    """Idempotently install required rule; preserve unrelated bucket rules."""
    bucket.reload()
    existing = list(bucket.lifecycle_rules)
    unsafe = [rule for rule in existing if _unsafe_overlap(rule, prefixes)]
    if unsafe:
        raise ValueError("Conflicting lifecycle Delete rule overlaps temporary paths; manual review required")
    if any(_matching_rule(rule, prefixes) for rule in existing):
        return False

    generation = bucket.metageneration
    if generation is None:
        raise RuntimeError("Bucket metageneration unavailable; refusing uncontrolled lifecycle patch")
    bucket.add_lifecycle_delete_rule(age=RETENTION_DAYS, matches_prefix=list(prefixes))
    bucket.patch(if_metageneration_match=int(generation))
    bucket.reload()
    if not any(_matching_rule(rule, prefixes) for rule in bucket.lifecycle_rules):
        raise RuntimeError("Temporary file lifecycle read-back verification failed")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bucket", default="program-tool.firebasestorage.app")
    parser.add_argument("--config", type=Path, default=ROOT / "storage-lifecycle.json")
    args = parser.parse_args()

    prefixes = required_prefixes(args.config)
    from google.cloud import storage

    client = storage.Client(project="program-tool")
    changed = ensure_temporary_retention(client.bucket(args.bucket), prefixes)
    print(
        f"Temporary Storage retention: {'updated' if changed else 'already configured'}; "
        f"delete after 1 day for {', '.join(prefixes)}; saved sessions excluded"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
