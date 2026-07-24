"""Synchronize Firebase admin custom claims from settings/admin.

Run in dry-run mode first:
    python -m scripts.sync_admin_claims

Apply changes after reviewing the output:
    python -m scripts.sync_admin_claims --apply
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


def _admin_emails() -> list[str]:
    snapshot = firestore.client().collection("settings").document("admin").get()
    data = snapshot.to_dict() if snapshot.exists else {}
    emails = (data or {}).get("emails")
    if not isinstance(emails, list):
        return []
    return sorted({value.strip().lower() for value in emails if isinstance(value, str) and value.strip()})


def sync_admin_claims(apply: bool = False) -> int:
    _initialize_firebase()
    emails = _admin_emails()
    if not emails:
        print("No administrator emails found in settings/admin.")
        return 0
    updated = 0
    for email in emails:
        try:
            user = auth.get_user_by_email(email)
        except auth.UserNotFoundError:
            print(f"SKIP user not found: {email}")
            continue
        claims = dict(user.custom_claims or {})
        if claims.get("admin") is True:
            print(f"OK   already admin: {email}")
            continue
        claims["admin"] = True
        if apply:
            auth.set_custom_user_claims(user.uid, claims)
            print(f"SET  admin=true: {email}")
        else:
            print(f"DRY  would set admin=true: {email}")
        updated += 1
    if not apply and updated:
        print("Dry run only. Re-run with --apply to update Firebase Auth.")
    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Synchronize Firebase administrator claims")
    parser.add_argument("--apply", action="store_true", help="Apply changes instead of dry-run")
    args = parser.parse_args()
    sync_admin_claims(apply=args.apply)


if __name__ == "__main__":
    main()
