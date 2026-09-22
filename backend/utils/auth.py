from functools import wraps

from firebase_admin import auth
from flask import g, jsonify, request


def require_admin(f):
    """Require the trusted Firebase custom claim admin=true."""

    @wraps(f)
    def decorated(*args, **kwargs):
        decoded = getattr(g, "auth_user", None)
        uid = getattr(g, "uid", None)
        if not isinstance(decoded, dict) or not isinstance(uid, str) or not uid:
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return jsonify({"detail": "로그인이 필요합니다."}), 401
            token = auth_header[7:].strip()
            if not token:
                return jsonify({"detail": "로그인이 필요합니다."}), 401
            try:
                decoded = auth.verify_id_token(token)
                uid = decoded.get("uid")
            except Exception:
                return jsonify({"detail": "로그인 정보가 유효하지 않습니다."}), 401

        if not isinstance(uid, str) or not uid:
            return jsonify({"detail": "로그인 정보가 유효하지 않습니다."}), 401
        if decoded.get("admin") is not True:
            return jsonify({"detail": "관리자 권한이 필요합니다."}), 403

        g.auth_user = decoded
        g.uid = uid
        g.is_admin = True
        return f(uid, *args, **kwargs)

    return decorated

def require_auth(f):
    """Require a Firebase identity, reusing the global permission-hook result.

    Managed API routes have already verified the token in ``before_request``.
    The fallback verification keeps this decorator safe for isolated tests or
    future routes that may use it outside that hook.
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        verified_uid = getattr(g, "uid", None)
        if isinstance(verified_uid, str) and verified_uid:
            return f(verified_uid, *args, **kwargs)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"detail": "로그인이 필요합니다."}), 401
        token = auth_header[7:].strip()
        if not token:
            return jsonify({"detail": "로그인이 필요합니다."}), 401
        try:
            decoded = auth.verify_id_token(token)
            uid = decoded["uid"]
        except Exception:
            return jsonify({"detail": "로그인 정보가 유효하지 않습니다."}), 401
        return f(uid, *args, **kwargs)

    return decorated
