"""Administrator-only AI billing dashboard endpoint."""
from __future__ import annotations

import logging

from flask import Blueprint, jsonify

from services.ai_usage_metrics import load_program_studio_image_summary
from services.openai_admin_usage import OpenAIAdminUsageError, fetch_openai_billing_summary
from utils.auth import require_admin

admin_ai_usage_bp = Blueprint("admin_ai_usage", __name__)
logger = logging.getLogger(__name__)


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
                "detail": str(exc),
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
