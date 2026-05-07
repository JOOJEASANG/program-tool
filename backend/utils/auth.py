from functools import wraps
from flask import request, jsonify
from firebase_admin import auth


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"detail": "Missing auth token"}), 401
        token = auth_header[7:]
        try:
            decoded = auth.verify_id_token(token)
            uid = decoded["uid"]
        except Exception:
            return jsonify({"detail": "Invalid auth token"}), 401
        return f(uid, *args, **kwargs)
    return decorated
