"""Administrator-only AI billing dashboard endpoint."""
from __future__ import annotations

import logging

from flask import Blueprint, jsonify

from services.ai_usage_metrics import load_program_studio_image_summary
from services.openai_admin_usage import OpenAIAdminUsageError, fetch_openai_billing_summary
from utils.auth import require_admin

admin_ai_usage_bp = Blueprint("admin_ai_usage", __name__)
logger = logging.getLogger(__name__)

_PUBLIC_OPENAI_ADMIN_ERRORS = {
    "OPENAI_ADMIN_KEY_MISSING": "OpenAI Admin API 키가 설정되지 않아 실제 청구액을 조회할 수 없습니다.",
    "OPENAI_ADMIN_AUTH_FAILED": "OpenAI Admin API 키 권한을 확인해 주세요.",
    "OPENAI_ADMIN_RATE_LIMIT": "OpenAI 비용 조회 한도에 도달했습니다. 잠시 후 다시 확인해 주세요.",
    "OPENAI_ADMIN_USAGE_TIMEOUT": "OpenAI 비용 조회 서버의 응답이 지연되고 있습니다.",
    "OPENAI_ADMIN_USAGE_INVALID_RESPONSE": "OpenAI 비용 조회 응답을 해석하지 못했습니다.",
    "OPENAI_ADMIN_USAGE_FAILED": "OpenAI 실제 비용을 조회하지 못했습니다.",
}


def _empty_program_summary() -> dict:
    return {
        "tracked_from": "",
        "today_requests": 0,
        "last_7_days_requests": 0,
        "month_requests": 0,
        "standard_requests": 0,
        "high_requests": 0,
        "by_model": [],
        "daily": [],
    }


@admin_ai_usage_bp.route("/ai-costs", methods=["GET"])
@require_admin
def ai_costs(uid):
    del uid
    tracking_available = True
    try:
        program_summary = load_program_studio_image_summary()
    except Exception:
        logger.exception("Program Studio AI usage summary failed")
        program_summary = _empty_program_summary()
        tracking_available = False

    try:
        payload = fetch_openai_billing_summary()
        payload["program_studio"] = program_summary
        payload["tracking_available"] = tracking_available
        return jsonify(payload)
    except OpenAIAdminUsageError as exc:
        logger.warning("OpenAI admin usage unavailable code=%s", exc.code)
        return jsonify(
            {
                "available": False,
                "source": "openai_costs_api",
                "code": exc.code,
                "detail": _PUBLIC_OPENAI_ADMIN_ERRORS.get(
                    exc.code,
                    "OpenAI 실제 비용을 조회하지 못했습니다.",
                ),
                "program_studio": program_summary,
                "tracking_available": tracking_available,
            }
        )
    except Exception:
        logger.exception("OpenAI admin usage summary failed")
        return jsonify(
            {
                "available": False,
                "source": "openai_costs_api",
                "code": "OPENAI_ADMIN_USAGE_FAILED",
                "detail": "OpenAI 실제 비용을 조회하지 못했습니다.",
                "program_studio": program_summary,
                "tracking_available": tracking_available,
            }
        )
