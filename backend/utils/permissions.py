"""Server-side program access checks for API routes.

Frontend permission checks are useful for UX, but every paid/restricted API must also
be protected on the backend because users can call /api/** directly.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from firebase_admin import auth, firestore
from flask import request


PROGRAM_BY_PREFIX: tuple[tuple[str, str], ...] = (
    ("/api/pdf-tools", "pdf-editor"),
    ("/api/pdf", "pdf-editor"),
    ("/api/preflight", "preflight"),
    ("/api/invoice", "invoice"),
    ("/api/report", "report"),
    ("/api/writing", "writing"),
)


class AccessError(Exception):
    """Raised when a request is authenticated but not authorized."""

    def __init__(self, message: str, status_code: int = 403):
        super().__init__(message)
        self.status_code = status_code


@lru_cache(maxsize=1)
def _db():
    return firestore.client()


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
    except Exception:
        raise AccessError("로그인 정보가 유효하지 않습니다.", 401)


def _lower_list(values) -> list[str]:
    if not isinstance(values, list):
        return []
    return [str(v).strip().lower() for v in values if str(v).strip()]


def has_program_access(uid: str, email: str, program_id: str) -> bool:
    """Check admin, public flag, or per-user permission for a program."""
    db = _db()
    email_lc = (email or "").strip().lower()

    admin_doc = db.collection("settings").document("admin").get()
    if admin_doc.exists:
        admin_emails = _lower_list((admin_doc.to_dict() or {}).get("emails"))
        if email_lc and email_lc in admin_emails:
            return True

    programs_doc = db.collection("settings").document("programs").get()
    if programs_doc.exists:
        public_flags = (programs_doc.to_dict() or {}).get("public") or {}
        if isinstance(public_flags, dict) and public_flags.get(program_id) is True:
            return True

    perm_doc = db.collection("user_permissions").document(uid).get()
    if perm_doc.exists:
        programs = (perm_doc.to_dict() or {}).get("programs") or {}
        if isinstance(programs, dict) and programs.get(program_id) is True:
            return True

    return False


def require_program_access_for_request():
    """Flask before_request hook. Returns decoded token if access is allowed."""
    program_id = program_for_path(request.path)
    if not program_id:
        return None

    decoded = verify_bearer_token()
    uid = decoded.get("uid")
    email = decoded.get("email", "")
    if not uid:
        raise AccessError("로그인 정보가 유효하지 않습니다.", 401)

    if not has_program_access(uid, email, program_id):
        raise AccessError("이 프로그램 사용 권한이 없습니다. 관리자 승인 후 이용할 수 있습니다.", 403)

    return decoded
