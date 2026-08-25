"""Server-side authentication and authorization for managed PDF tools."""
from __future__ import annotations

from typing import Optional

from firebase_admin import auth, firestore
from flask import g, request


PROGRAM_BY_PREFIX: tuple[tuple[str, str], ...] = (
    ("/api/pdf-tools", "preflight"),
    ("/api/pdf", "pdf-editor"),
    ("/api/pdf-utility", "preflight"),
    ("/api/preflight", "preflight"),
)


class AccessError(Exception):
    """Raised when a request is unauthenticated or not authorized."""

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
    email = decoded.get("email")
    return email.strip().lower() if isinstance(email, str) else ""


def _has_admin_claim(decoded: dict) -> bool:
    """Return True only for the trusted Firebase custom claim."""
    return decoded.get("admin") is True


def _is_legacy_admin(db: firestore.Client, email: str) -> bool:
    """Temporary migration fallback for administrators without a custom claim yet."""
    if not email:
        return False
    snapshot = db.collection("settings").document("admin").get()
    if not snapshot.exists:
        return False
    data = snapshot.to_dict() or {}
    emails = data.get("emails")
    if not isinstance(emails, list):
        return False
    return email in {
        value.strip().lower()
        for value in emails
        if isinstance(value, str) and value.strip()
    }


def _snapshot_data(snapshot) -> dict:
    if snapshot is None or not getattr(snapshot, "exists", False):
        return {}
    return snapshot.to_dict() or {}


def _program_access_from_snapshots(program_snapshot, permission_snapshot, program_id: str) -> bool:
    """Evaluate the shared administrator-approval policy.

    Program catalog/public metadata is intentionally ignored for authorization.
    Every non-administrator account must have ``status == 'approved'`` before it
    can use any managed program. The legacy ``programs`` map remains only for
    document compatibility and is not an authorization input.
    """
    del program_snapshot, program_id
    permission_data = _snapshot_data(permission_snapshot)
    return permission_data.get("status") == "approved"


def _has_program_access(db: firestore.Client, uid: str, program_id: str) -> bool:
    """Return whether the account itself has administrator approval.

    Keep the existing ``get_all`` lookup shape so authorization remains compatible
    with the repository's Firestore batching/mocking path while no longer reading
    public-program settings for access decisions.
    """
    permission_ref = db.collection("user_permissions").document(uid)
    snapshots = list(db.get_all([permission_ref]))
    permission_snapshot = snapshots[0] if snapshots else None
    return _program_access_from_snapshots(None, permission_snapshot, program_id)


def require_program_access_for_request():
    """Flask before_request hook enforcing one shared program-access policy.

    The verified identity is stored on ``flask.g`` so route decorators can reuse
    it instead of verifying the same Firebase ID token a second time.
    """
    program_id = program_for_path(request.path)
    if not program_id:
        return None

    decoded = verify_bearer_token()
    uid = decoded.get("uid")
    if not isinstance(uid, str) or not uid:
        raise AccessError("로그인 정보가 유효하지 않습니다.", 401)

    try:
        db = firestore.client()
        is_admin = _has_admin_claim(decoded)
        if not is_admin:
            is_admin = _is_legacy_admin(db, _normalized_email(decoded))
        if not is_admin and not _has_program_access(db, uid, program_id):
            raise AccessError("관리자 승인 후 이 프로그램을 사용할 수 있습니다.", 403)
    except AccessError:
        raise
    except Exception as exc:
        raise AccessError("권한 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.", 503) from exc

    g.auth_user = decoded
    g.uid = uid
    g.program_id = program_id
    g.is_admin = is_admin
    return decoded
