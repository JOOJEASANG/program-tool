"""Server-side access checks for the remaining PDF tools."""
from __future__ import annotations

from typing import Optional

from firebase_admin import auth
from flask import request


PROGRAM_BY_PREFIX: tuple[tuple[str, str], ...] = (
    ("/api/pdf-tools", "pdf-editor"),
    ("/api/pdf", "pdf-editor"),
    ("/api/preflight", "preflight"),
)


class AccessError(Exception):
    """Raised when a request is authenticated but not authorized."""

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
    except Exception:
        raise AccessError("로그인 정보가 유효하지 않습니다.", 401)


def require_program_access_for_request():
    """Flask before_request hook. Signed-in members may use the remaining PDF tools."""
    program_id = program_for_path(request.path)
    if not program_id:
        return None

    decoded = verify_bearer_token()
    if not decoded.get("uid"):
        raise AccessError("로그인 정보가 유효하지 않습니다.", 401)
    return decoded
