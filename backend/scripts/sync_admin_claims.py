"""Synchronize Firebase admin custom claims from settings/admin.

Dry-run:
    python -m scripts.sync_admin_claims

Apply additions and revoke stale claims:
    python -m scripts.sync_admin_claims --apply --revoke-missing
"""
from __future__ import annotations

import argparse

import firebase_admin
from firebase_admin import auth, firestore


def _initialize_firebase() -> None:
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app()


def _admin_emails() -> set[str]:
    snapshot = firestore.client().collection("settings").document("admin").get()
    data = snapshot.to_dict() if snapshot.exists else {}
    emails = (data or {}).get("emails")
    if not isinstance(emails, list):
        return set()
    return {
        value.strip().lower()
        for value in emails
        if isinstance(value, str) and value.strip()
    }


def _set_admin_claim(user, enabled: bool, apply: bool) -> bool:
    claims = dict(user.custom_claims or {})
    current = claims.get("admin") is True
    if current == enabled:
        return False
    if enabled:
        claims["admin"] = True
    else:
        claims.pop("admin", None)
    action = "SET" if enabled else "REVOKE"
    if apply:
        auth.set_custom_user_claims(user.uid, claims or None)
        print(f"{action:6} admin={str(enabled).lower()}: {user.email or user.uid}")
    else:
        print(f"DRY    would {action.lower()} admin={str(enabled).lower()}: {user.email or user.uid}")
    return True


def sync_admin_claims(apply: bool = False, revoke_missing: bool = False) -> int:
    _initialize_firebase()
    admin_emails = _admin_emails()
    if not admin_emails:
        print("No administrator emails found in settings/admin.")
        if not revoke_missing:
            return 0

    changed = 0
    for email in sorted(admin_emails):
        try:
            user = auth.get_user_by_email(email)
        except auth.UserNotFoundError:
            print(f"SKIP   user not found: {email}")
            continue
        changed += int(_set_admin_claim(user, True, apply))

    if revoke_missing:
        page = auth.list_users()
        while page:
            for user in page.users:
                if not (user.custom_claims or {}).get("admin"):
                    continue
                email = (user.email or "").strip().lower()
                if email and email in admin_emails:
                    continue
                changed += int(_set_admin_claim(user, False, apply))
            page = page.get_next_page()

    if not apply and changed:
        print("Dry run only. Re-run with --apply after reviewing the output.")
    if apply and changed:
        print("Claim changes applied. Affected users must refresh their ID token.")
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Synchronize Firebase administrator claims"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes instead of dry-run",
    )
    parser.add_argument(
        "--revoke-missing",
        action="store_true",
        help="Remove admin=true from users absent from settings/admin",
    )
    args = parser.parse_args()
    sync_admin_claims(
        apply=args.apply,
        revoke_missing=args.revoke_missing,
    )


if __name__ == "__main__":
    main()
