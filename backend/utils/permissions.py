"""Server-side authentication and program authorization checks."""
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


def _normalized_email(decoded: dict) -> str:
    return str(decoded.get("email") or "").strip().lower()


def _is_admin(db, email: str) -> bool:
    if not email:
        return False
    snap = db.collection("settings").document("admin").get()
    if not snap.exists:
        return False
    emails = snap.to_dict().get("emails", []) or []
    return email in {str(item).strip().lower() for item in emails}


def _is_program_public(db, program_id: str) -> bool:
    snap = db.collection("settings").document("programs").get()
    if not snap.exists:
        return False
    public_map = snap.to_dict().get("public", {}) or {}
    return public_map.get(program_id) is True


def _has_member_program_access(db, uid: str, program_id: str) -> bool:
    snap = db.collection("user_permissions").document(uid).get()
    if not snap.exists:
        return False
    data = snap.to_dict() or {}
    if data.get("status") != "approved":
        return False
    programs = data.get("programs", {}) or {}
    return programs.get(program_id) is True


def require_program_access_for_request():
    """Flask before_request hook enforcing server-side program authorization."""
    program_id = program_for_path(request.path)
    if not program_id:
        return None

    decoded = verify_bearer_token()
    uid = decoded.get("uid")
    if not uid:
        raise AccessError("로그인 정보가 유효하지 않습니다.", 401)

    try:
        db = firestore.client()
        if _is_admin(db, _normalized_email(decoded)):
            return decoded
        if _is_program_public(db, program_id):
            return decoded
        if _has_member_program_access(db, uid, program_id):
            return decoded
    except AccessError:
        raise
    except Exception as exc:
        raise AccessError("권한 정보를 확인할 수 없습니다.", 503) from exc

    raise AccessError("이 프로그램을 사용할 권한이 없습니다.", 403)
