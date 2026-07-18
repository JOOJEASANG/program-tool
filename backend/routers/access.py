"""Authenticated access-status endpoint shared by browser tools."""
from flask import Blueprint, jsonify

from utils.permissions import AccessError, get_program_access, verify_bearer_token

access_bp = Blueprint("access", __name__)


@access_bp.route("/<program_id>", methods=["GET"])
def access_status(program_id: str):
    try:
        decoded = verify_bearer_token()
        return jsonify(get_program_access(decoded, program_id))
    except AccessError as exc:
        return jsonify({"detail": str(exc)}), exc.status_code
