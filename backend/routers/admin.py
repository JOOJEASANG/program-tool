"""Server-side administrator and program visibility management."""
from __future__ import annotations

from functools import wraps

from firebase_admin import firestore
from flask import Blueprint, jsonify, request

from utils.permissions import (
    AccessError,
    DEFAULT_PUBLIC_PROGRAMS,
    PROGRAM_IDS,
    is_admin_identity,
    normalize_email,
    require_admin_for_request,
    verify_bearer_token,
)

admin_bp = Blueprint("admin", __name__)


def _json_error(exc: AccessError):
    return jsonify({"detail": str(exc)}), exc.status_code


def admin_required(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        try:
            decoded = require_admin_for_request()
            return func(decoded, *args, **kwargs)
        except AccessError as exc:
            return _json_error(exc)
    return wrapped


def _admin_ref():
    return firestore.client().collection("settings").document("admin")


def _programs_ref():
    return firestore.client().collection("settings").document("programs")


def _stored_admins() -> set[str]:
    snap = _admin_ref().get()
    if not snap.exists:
        return set()
    return {normalize_email(item) for item in (snap.to_dict().get("emails") or []) if normalize_email(item)}


@admin_bp.route("/me", methods=["GET"])
def me():
    try:
        decoded = verify_bearer_token()
        return jsonify({
            "uid": decoded.get("uid"),
            "email": normalize_email(decoded.get("email")),
            "isAdmin": is_admin_identity(decoded),
        })
    except AccessError as exc:
        return _json_error(exc)


@admin_bp.route("/admins", methods=["GET"])
@admin_required
def list_admins(decoded):
    emails = sorted(_stored_admins())
    current = normalize_email(decoded.get("email"))
    if current and current not in emails:
        # Custom-claim or environment administrators are shown without
        # silently writing their address into Firestore.
        emails.append(current)
        emails.sort()
    return jsonify({"emails": emails, "currentEmail": current})


@admin_bp.route("/admins", methods=["POST"])
@admin_required
def add_admin(decoded):
    payload = request.get_json(silent=True) or {}
    email = normalize_email(payload.get("email"))
    if not email or "@" not in email or len(email) > 254:
        return jsonify({"detail": "올바른 이메일을 입력하세요."}), 400

    emails = _stored_admins()
    emails.add(email)
    current = normalize_email(decoded.get("email"))
    if current:
        emails.add(current)
    _admin_ref().set({"emails": sorted(emails)}, merge=True)
    return jsonify({"emails": sorted(emails)})


@admin_bp.route("/admins", methods=["DELETE"])
@admin_required
def remove_admin(decoded):
    payload = request.get_json(silent=True) or {}
    email = normalize_email(payload.get("email"))
    current = normalize_email(decoded.get("email"))
    if not email:
        return jsonify({"detail": "삭제할 이메일이 없습니다."}), 400
    if email == current:
        return jsonify({"detail": "현재 로그인한 본인은 삭제할 수 없습니다."}), 400

    emails = _stored_admins()
    if email not in emails:
        return jsonify({"emails": sorted(emails)})
    if len(emails) <= 1:
        return jsonify({"detail": "마지막 관리자는 삭제할 수 없습니다."}), 400
    emails.remove(email)
    _admin_ref().set({"emails": sorted(emails)}, merge=True)
    return jsonify({"emails": sorted(emails)})


@admin_bp.route("/programs", methods=["GET"])
@admin_required
def list_programs(_decoded):
    public = dict(DEFAULT_PUBLIC_PROGRAMS)
    snap = _programs_ref().get()
    if snap.exists:
        stored = snap.to_dict().get("public") or {}
        if isinstance(stored, dict):
            for program_id in PROGRAM_IDS:
                if program_id in stored:
                    public[program_id] = stored.get(program_id) is True
    return jsonify({"public": public})


@admin_bp.route("/programs", methods=["PUT"])
@admin_required
def update_programs(_decoded):
    payload = request.get_json(silent=True) or {}
    requested = payload.get("public")
    if not isinstance(requested, dict):
        return jsonify({"detail": "프로그램 공개 설정 형식이 올바르지 않습니다."}), 400

    clean: dict[str, bool] = {}
    for program_id in PROGRAM_IDS:
        if program_id in requested:
            if not isinstance(requested[program_id], bool):
                return jsonify({"detail": f"{program_id} 공개 설정은 true 또는 false여야 합니다."}), 400
            clean[program_id] = requested[program_id]

    if not clean:
        return jsonify({"detail": "변경할 프로그램 설정이 없습니다."}), 400
    _programs_ref().set({"public": clean}, merge=True)
    return list_programs.__wrapped__(_decoded)
