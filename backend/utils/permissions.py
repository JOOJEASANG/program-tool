"""Server-side authentication and per-program authorization checks."""
from __future__ import annotations

from typing import Optional

from firebase_admin import auth, firestore
from flask import request


PROGRAM_BY_PREFIX: tuple[tuple[str, str], ...] = (
    ("/api/pdf-tools", "pdf-editor"),
    ("/api/pdf", "pdf-editor"),
    ("/api/preflight", "preflight"),
)


class AccessError(Exception):
    """Raised when a request is unauthenticated or unauthorized."""

    def __init__(self, message: str, status_code: int = 403):
        super().__init__(message)
        self.status_code = status_code


def program_for_path(path: str) -> Optional[str]:
    """Return the managed program id for an API path, or None for public paths."""
    for prefix, program_id in PROGRAM_BY_PREFIX:
        if path == prefix or path.startswith(prefix + "/"):
            return program_id
    return None


def _normalize_email(value: object) -> str:
    return str(value or "").strip().lower()


def verify_bearer_token() -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise AccessError("로그인이 필요합니다.", 401)
    token = auth_header[7:].strip()
    if not token:
        raise AccessError("로그인이 필요합니다.", 401)
    try:
        return auth.verify_id_token(token)
    except Exception as exc:
        raise AccessError("로그인 정보가 유효하지 않습니다.", 401) from exc


def _document_data(snapshot) -> dict:
    return snapshot.to_dict() if snapshot is not None and snapshot.exists else {}


def _is_admin(db, decoded: dict, profile_data: dict) -> bool:
    email = _normalize_email(decoded.get("email"))
    if not email:
        return bool(
            profile_data.get("role") == "admin"
            or profile_data.get("isAdmin") is True
            or profile_data.get("admin") is True
        )

    admin_data = _document_data(db.collection("settings").document("admin").get())
    admin_emails = {_normalize_email(value) for value in admin_data.get("emails", [])}
    if email in admin_emails:
        return True

    if db.collection("admins").document(email).get().exists:
        return True

    return bool(
        profile_data.get("role") == "admin"
        or profile_data.get("isAdmin") is True
        or profile_data.get("admin") is True
    )


def _is_program_public(db, program_id: str) -> bool:
    programs_data = _document_data(db.collection("settings").document("programs").get())
    public_map = programs_data.get("public")
    return isinstance(public_map, dict) and public_map.get(program_id) is True


def require_program_access_for_request():
    """Flask before-request hook enforcing approval and per-program access.

    Firebase Security Rules protect client-side database access, but Admin SDK calls
    bypass those rules. The API therefore performs the same checks independently.
    """
    program_id = program_for_path(request.path)
    if not program_id:
        return None

    decoded = verify_bearer_token()
    uid = str(decoded.get("uid") or "").strip()
    if not uid:
        raise AccessError("로그인 정보가 유효하지 않습니다.", 401)

    try:
        db = firestore.client()
        profile_snapshot = db.collection("user_permissions").document(uid).get()
        profile_data = _document_data(profile_snapshot)

        if _is_admin(db, decoded, profile_data):
            decoded["program_id"] = program_id
            decoded["program_access"] = "admin"
            return decoded

        status = str(profile_data.get("status") or "pending").strip().lower()
        if status != "approved":
            if status == "suspended":
                raise AccessError("이용이 중지된 계정입니다.", 403)
            raise AccessError("관리자 승인 후 사용할 수 있습니다.", 403)

        if _is_program_public(db, program_id):
            decoded["program_id"] = program_id
            decoded["program_access"] = "public"
            return decoded

        programs = profile_data.get("programs")
        if isinstance(programs, dict) and programs.get(program_id) is True:
            decoded["program_id"] = program_id
            decoded["program_access"] = "granted"
            return decoded

        raise AccessError("이 프로그램을 사용할 권한이 없습니다.", 403)
    except AccessError:
        raise
    except Exception as exc:
        raise AccessError("권한 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.", 503) from exc
