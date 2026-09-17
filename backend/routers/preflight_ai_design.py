"""Extension routes for design review and AI cover generation."""
from __future__ import annotations

import logging

from flask import jsonify, request

from services.ai_cover_image import AiCoverImageError, generate_cover_image
from services.ai_design_layout import AiDesignError, generate_layout
from utils.auth import require_auth
from utils.storage import get_request_id

logger = logging.getLogger(__name__)

_PUBLIC_AI_ERRORS = {
    "AI_DESIGN_TITLE_REQUIRED": "제목을 입력해 주세요.",
    "AI_COVER_STYLE_REQUIRED": "디자인 스타일을 선택하거나 입력해 주세요.",
    "AI_COVER_RATIO_UNSUPPORTED": "전체 펼침 표지 비율이 이미지 생성 지원 범위를 벗어났습니다.",
    "OPENAI_API_KEY_MISSING": "관리자 OpenAI API 키가 아직 서버에 설정되지 않았습니다.",
    "OPENAI_AUTH_FAILED": "OpenAI API 키 또는 프로젝트 권한을 확인해 주세요.",
    "OPENAI_RATE_LIMIT": "AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
    "OPENAI_REQUEST_FAILED": "OpenAI 디자인 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    "OPENAI_IMAGE_REQUEST_INVALID": "AI 이미지 생성 입력값을 확인해 주세요.",
    "OPENAI_IMAGE_REQUEST_FAILED": "AI 표지 이미지 생성 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    "OPENAI_IMAGE_UNAVAILABLE": "AI 이미지 서버 응답을 받지 못했습니다. 다시 시도해 주세요.",
    "OPENAI_IMAGE_EMPTY": "AI 표지 이미지 결과를 받지 못했습니다.",
    "AI_COVER_IMAGE_FAILED": "AI 표지 이미지 생성 요청을 처리하지 못했습니다.",
    "AI_DESIGN_FAILED": "AI 디자인 요청을 처리하지 못했습니다. 다시 시도해 주세요.",
}


def _error(detail: str, status: int, code: str):
    response = jsonify({
        "detail": detail,
        "code": code,
        "request_id": get_request_id(),
    })
    response.status_code = status
    response.headers["X-Request-ID"] = get_request_id()
    return response


def _public_ai_error(exc):
    raw_code = str(getattr(exc, "code", "") or "")
    fallback = "AI_COVER_IMAGE_FAILED" if isinstance(exc, AiCoverImageError) else "AI_DESIGN_FAILED"
    code = raw_code if raw_code in _PUBLIC_AI_ERRORS else fallback
    try:
        status = int(getattr(exc, "status_code", 502))
    except (TypeError, ValueError):
        status = 502
    status = status if 400 <= status <= 599 else 502
    return _error(_PUBLIC_AI_ERRORS[code], status, code)


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
            return _public_ai_error(exc)
        except Exception:
            logger.exception("AI design layout failed")
            return _error(
                "AI 디자인을 생성하는 중 오류가 발생했습니다.",
                500,
                "AI_DESIGN_INTERNAL_ERROR",
            )

    @blueprint.route("/ai-design/cover-image", methods=["POST"])
    @require_auth
    def ai_design_cover_image(uid):
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return _error("표지 제작 입력값을 확인해 주세요.", 400, "AI_COVER_PAYLOAD_INVALID")
        try:
            result = generate_cover_image(payload, uid=uid)
            response = jsonify(result)
            response.headers["X-Request-ID"] = get_request_id()
            return response
        except AiCoverImageError as exc:
            return _public_ai_error(exc)
        except Exception:
            logger.exception("AI cover image generation failed")
            return _error(
                "AI 표지 이미지를 생성하는 중 오류가 발생했습니다.",
                500,
                "AI_COVER_INTERNAL_ERROR",
            )
