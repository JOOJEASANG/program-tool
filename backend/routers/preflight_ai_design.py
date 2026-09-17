"""Extension routes for the print-checker AI design beta."""
from __future__ import annotations

import logging

from flask import jsonify, request

from services.ai_design_layout import AiDesignError, generate_layout
from utils.auth import require_auth
from utils.storage import get_request_id

logger = logging.getLogger(__name__)


def _error(detail: str, status: int, code: str):
    response = jsonify({
        "detail": detail,
        "code": code,
        "request_id": get_request_id(),
    })
    response.status_code = status
    return response


def install(preflight_module) -> None:
    """Attach AI design endpoints to the canonical preflight blueprint."""
    blueprint = preflight_module.preflight_bp
    if getattr(blueprint, "_ai_design_installed", False):
        return
    blueprint._ai_design_installed = True

    @blueprint.route("/ai-design/layout", methods=["POST"])
    @require_auth
    def ai_design_layout(uid):
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return _error("디자인 입력값을 확인해 주세요.", 400, "AI_DESIGN_PAYLOAD_INVALID")
        try:
            result = generate_layout(payload, uid=uid)
            response = jsonify(result)
            response.headers["X-Request-ID"] = get_request_id()
            return response
        except AiDesignError as exc:
            return _error(str(exc), exc.status_code, exc.code)
        except Exception:
            logger.exception("AI design layout failed request_id=%s", get_request_id())
            return _error(
                "AI 디자인을 생성하는 중 오류가 발생했습니다.",
                500,
                "AI_DESIGN_INTERNAL_ERROR",
            )
