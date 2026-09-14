"""Server-side authentication and per-program authorization for managed tools."""
from __future__ import annotations

from typing import Optional

from firebase_admin import auth, firestore
from flask import g, request


# API families may be shared by multiple front-end programs. The client sends
# X-Program-ID and the server accepts it only when it belongs to that API family.
PROGRAMS_BY_PREFIX: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("/api/pdf-tools", ("pdf-preflight", "print-checker")),
    ("/api/pdf", ("pdf-editor", "pdf-editor-advanced", "smart-print-layout")),
    ("/api/pdf-utility", ("pdf-preflight", "print-checker")),
    ("/api/preflight", ("pdf-preflight", "print-checker")),
)
DEFAULT_PROGRAM_BY_PREFIX = {
    "/api/pdf-tools": "pdf-preflight",
    "/api/pdf": "pdf-editor",
    "/api/pdf-utility": "pdf-preflight",
    "/api/preflight": "pdf-preflight",
}


class AccessError(Exception):
    """Raised when a request is unauthenticated or not authorized."""

    def __init__(self, message: str, status_code: int = 403):
        super().__init__(message)
        self.status_code = status_code


def _program_family_for_path(path: str) -> tuple[str, tuple[str, ...]] | None:
    for prefix, programs in PROGRAMS_BY_PREFIX:
        if path == prefix or path.startswith(prefix + "/"):
            return prefix, programs
    return None


def program_for_path(path: str) -> Optional[str]:
    """Resolve and validate the caller's program id for a managed API path."""
    family = _program_family_for_path(path)
    if family is None:
        return None
    prefix, allowed = family
    requested = (request.headers.get("X-Program-ID") or "").strip().lower()
    if requested:
        if requested not in allowed:
            raise AccessError("이 프로그램에서는 요청한 서버 기능을 사용할 수 없습니다.", 403)
        return requested
    return DEFAULT_PROGRAM_BY_PREFIX[prefix]


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
    return decoded.get("admin") is True


def _is_legacy_admin(db: firestore.Client, email: str) -> bool:
    """Temporary fallback for administrators that do not yet have admin=true."""
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
    """Evaluate account approval plus explicit program assignment.

    Existing approved users created before ``programsAll`` was introduced retain
    all-program access until an administrator saves an explicit policy. This keeps
    the migration non-breaking while every new account starts with no programs.
    """
    del program_snapshot
    data = _snapshot_data(permission_snapshot)
    if data.get("status") != "approved":
        return False
    if "programsAll" not in data:
        return True
    if data.get("programsAll") is True:
        return True
    programs = data.get("programs")
    return isinstance(programs, dict) and programs.get(program_id) is True


def _permission_snapshot(db: firestore.Client, uid: str):
    reference = db.collection("user_permissions").document(uid)
    snapshots = list(db.get_all([reference]))
    return snapshots[0] if snapshots else None


def _has_program_access(db: firestore.Client, uid: str, program_id: str) -> bool:
    return _program_access_from_snapshots(
        None,
        _permission_snapshot(db, uid),
        program_id,
    )


def require_program_access_for_request():
    """Flask before_request hook enforcing administrator-approved program access."""
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
        permission_snapshot = None

        # Normal members use only one Firestore permission read. The legacy
        # administrator document is consulted only when the member policy did not
        # already allow the request, reducing reads on the common path.
        if not is_admin:
            permission_snapshot = _permission_snapshot(db, uid)
            has_access = _program_access_from_snapshots(None, permission_snapshot, program_id)
            if not has_access:
                is_admin = _is_legacy_admin(db, _normalized_email(decoded))
                if not is_admin:
                    data = _snapshot_data(permission_snapshot)
                    if data.get("status") != "approved":
                        raise AccessError("관리자가 회원 승인을 완료한 후 사용할 수 있습니다.", 403)
                    raise AccessError("이 프로그램의 사용 권한이 없습니다. 관리자에게 권한 승인을 요청해 주세요.", 403)
    except AccessError:
        raise
    except Exception as exc:
        raise AccessError("권한 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.", 503) from exc

    g.auth_user = decoded
    g.uid = uid
    g.program_id = program_id
    g.is_admin = is_admin
    return decoded
