"""Authentication and authorization helpers for Program Tool APIs."""
from __future__ import annotations

import os
from typing import Optional

from firebase_admin import auth, firestore
from flask import request

PROGRAM_BY_PREFIX: tuple[tuple[str, str], ...] = (
    ("/api/pdf-tools", "preflight"),
    ("/api/pdf", "pdf-editor"),
    ("/api/preflight", "preflight"),
)

PROGRAM_IDS = frozenset({"pdf-editor", "preflight", "perfect-binding-cover"})

# Preserve the site's existing behavior unless an administrator explicitly
# changes settings/programs.public in Firestore.
DEFAULT_PUBLIC_PROGRAMS: dict[str, bool] = {
    "pdf-editor": False,
    "preflight": True,
    "perfect-binding-cover": True,
}


class AccessError(Exception):
    """Raised when a request is unauthenticated or unauthorized."""

    def __init__(self, message: str, status_code: int = 403):
        super().__init__(message)
        self.status_code = status_code


def normalize_email(value: object) -> str:
    return str(value or "").strip().lower()


def _initial_admin_emails() -> set[str]:
    """Return trusted bootstrap admins configured outside the client bundle.

    Set INITIAL_ADMIN_EMAILS in the Cloud Functions environment to a
    comma-separated list. Firebase custom claim ``admin=true`` is also
    supported and is preferred for long-term operation.
    """
    raw = os.environ.get("INITIAL_ADMIN_EMAILS", "")
    return {normalize_email(item) for item in raw.split(",") if normalize_email(item)}


def program_for_path(path: str) -> Optional[str]:
    """Return the managed program id for an API path, or None for public paths."""
    for prefix, program_id in PROGRAM_BY_PREFIX:
        if path == prefix or path.startswith(prefix + "/"):
            return program_id
    return None


def verify_bearer_token() -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise AccessError("로그인이 필요합니다.", 401)
    token = auth_header[7:].strip()
    if not token:
        raise AccessError("로그인이 필요합니다.", 401)
    try:
        decoded = auth.verify_id_token(token)
    except Exception as exc:
        raise AccessError("로그인 정보가 유효하지 않습니다.", 401) from exc
    if not decoded.get("uid"):
        raise AccessError("로그인 정보가 유효하지 않습니다.", 401)
    return decoded


def _admin_document_emails() -> set[str]:
    try:
        snap = firestore.client().collection("settings").document("admin").get()
        if not snap.exists:
            return set()
        return {normalize_email(item) for item in (snap.to_dict().get("emails") or []) if normalize_email(item)}
    except Exception:
        # A database outage must never grant access. Environment admins and
        # custom claims remain available as break-glass mechanisms.
        return set()


def is_admin_identity(decoded: dict) -> bool:
    if decoded.get("admin") is True:
        return True
    email = normalize_email(decoded.get("email"))
    if not email:
        return False
    return email in _initial_admin_emails() or email in _admin_document_emails()


def _permission_data(decoded: dict, db) -> dict:
    """Read or initialize the current user's permission record.

    The Admin SDK write avoids relying on a separate signup-page write and
    guarantees that administrators have a user list to approve later.
    """
    uid = str(decoded.get("uid") or "")
    ref = db.collection("user_permissions").document(uid)
    snap = ref.get()
    defaults = {program_id: False for program_id in PROGRAM_IDS}
    if not snap.exists:
        data = {
            "uid": uid,
            "email": normalize_email(decoded.get("email")),
            "displayName": str(decoded.get("name") or decoded.get("email") or "사용자")[:120],
            "programs": defaults,
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
        ref.set(data)
        return data

    data = snap.to_dict() or {}
    programs = data.get("programs") if isinstance(data.get("programs"), dict) else {}
    missing = {program_id: False for program_id in PROGRAM_IDS if program_id not in programs}
    updates = {}
    if missing:
        for program_id, value in missing.items():
            updates[f"programs.{program_id}"] = value
            programs[program_id] = value
    token_email = normalize_email(decoded.get("email"))
    if token_email and normalize_email(data.get("email")) != token_email:
        updates["email"] = token_email
        data["email"] = token_email
    token_name = str(decoded.get("name") or "").strip()[:120]
    if token_name and data.get("displayName") != token_name:
        updates["displayName"] = token_name
        data["displayName"] = token_name
    if updates:
        ref.update(updates)
    data["programs"] = {**defaults, **programs}
    return data


def get_program_access(decoded: dict, program_id: str) -> dict:
    """Resolve admin/public/per-user access for one program."""
    if program_id not in PROGRAM_IDS:
        raise AccessError("알 수 없는 프로그램입니다.", 404)

    is_admin = is_admin_identity(decoded)
    is_public = DEFAULT_PUBLIC_PROGRAMS.get(program_id, False)
    is_approved = False

    try:
        db = firestore.client()
        settings_snap = db.collection("settings").document("programs").get()
        if settings_snap.exists:
            public_map = settings_snap.to_dict().get("public") or {}
            if isinstance(public_map, dict) and program_id in public_map:
                is_public = public_map.get(program_id) is True

        permission = _permission_data(decoded, db)
        programs = permission.get("programs") or {}
        is_approved = isinstance(programs, dict) and programs.get(program_id) is True
    except Exception as exc:
        # Admin claims remain usable during a Firestore outage, but normal
        # users are denied rather than accidentally granted access.
        if not is_admin:
            raise AccessError("사용 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.", 503) from exc

    return {
        "programId": program_id,
        "allowed": bool(is_admin or is_public or is_approved),
        "isAdmin": bool(is_admin),
        "isPublic": bool(is_public),
        "isApproved": bool(is_approved),
    }


def require_program_access_for_request():
    """Flask before-request hook that enforces managed API permissions."""
    if request.method == "OPTIONS":
        return None
    program_id = program_for_path(request.path)
    if not program_id:
        return None

    decoded = verify_bearer_token()
    access = get_program_access(decoded, program_id)
    if not access["allowed"]:
        raise AccessError("이 프로그램을 사용할 권한이 없습니다.", 403)
    request.environ["program_tool.identity"] = decoded
    request.environ["program_tool.access"] = access
    return decoded


def require_admin_for_request() -> dict:
    decoded = verify_bearer_token()
    if not is_admin_identity(decoded):
        raise AccessError("관리자 권한이 필요합니다.", 403)
    return decoded
