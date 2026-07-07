"""Server-side program access checks for API routes.

All signed-in members may use non-AI programs. AI routes remain controlled by the
admin AI feature switch stored at settings/programs.aiEnabled.
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
    ("/api/ai", "design-studio"),
)

AI_FEATURE_PREFIXES: tuple[str, ...] = (
    "/api/ai",
    "/api/writing",
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


def is_ai_feature_path(path: str) -> bool:
    """Return True when a request targets a globally toggleable AI feature."""
    return any(path == prefix or path.startswith(prefix + "/") for prefix in AI_FEATURE_PREFIXES)


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


def ai_enabled() -> bool:
    """Read the global AI feature switch. Missing settings default to enabled."""
    try:
        programs_doc = _db().collection("settings").document("programs").get()
        programs_data = (programs_doc.to_dict() or {}) if programs_doc.exists else {}
        return programs_data.get("aiEnabled") is not False
    except Exception:
        # Do not accidentally lock normal members out because of a transient read issue.
        return True


def has_program_access(uid: str, email: str, program_id: str) -> bool:
    """All signed-in members can use free programs; AI obeys the global switch."""
    if is_ai_feature_path(request.path):
        return ai_enabled()
    return True


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
        if is_ai_feature_path(request.path):
            raise AccessError("AI 기능이 관리자 설정에서 비활성화되어 있습니다.", 403)
        raise AccessError("로그인한 회원만 사용할 수 있습니다.", 403)

    return decoded
