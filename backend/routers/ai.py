from flask import Blueprint, jsonify
from utils.auth import require_auth

ai_bp = Blueprint("ai", __name__)

AI_DISABLED_MESSAGE = (
    "AI 유료 API 기능은 현재 비활성화되어 있습니다. "
    "무료 사용을 위해 배경 이미지는 직접 업로드해서 사용하세요."
)


@ai_bp.route("/generate-bg", methods=["POST"])
@require_auth
def generate_bg(uid):
    """Paid AI image generation is intentionally disabled.

    This endpoint used to call Google Imagen or OpenAI image generation, which can
    incur API charges. It now returns before any provider SDK is imported or called.
    """
    return jsonify({
        "detail": AI_DISABLED_MESSAGE,
        "ai_disabled": True,
        "free_alternative": "배경 이미지 직접 업로드"
    }), 402
