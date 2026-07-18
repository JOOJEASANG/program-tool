"""Grant or remove the Firebase Auth admin custom claim.

Requires Application Default Credentials or a service account configured for
Firebase Admin SDK access.
"""
from __future__ import annotations

import argparse

import firebase_admin
from firebase_admin import auth


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("email", help="Firebase Auth account email")
    parser.add_argument("--remove", action="store_true", help="remove the admin claim")
    args = parser.parse_args()

    firebase_admin.initialize_app()
    user = auth.get_user_by_email(args.email.strip())
    claims = dict(user.custom_claims or {})
    if args.remove:
        claims.pop("admin", None)
    else:
        claims["admin"] = True
    auth.set_custom_user_claims(user.uid, claims or None)
    action = "removed from" if args.remove else "granted to"
    print(f"admin claim {action} {user.email} ({user.uid})")
    print("The user must sign out and sign in again to refresh the ID token.")


if __name__ == "__main__":
    main()
