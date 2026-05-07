import os
from flask import Blueprint, request, jsonify
from openai import OpenAI
from utils.auth import require_auth

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/generate-bg", methods=["POST"])
@require_auth
def generate_bg(uid):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return jsonify({"detail": "OPENAI_API_KEY가 설정되지 않았습니다."}), 500

    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    if not prompt:
        return jsonify({"detail": "프롬프트가 없습니다."}), 400

    try:
        client = OpenAI(api_key=api_key)
        response = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            n=1,
            size="1536x1024",
            quality="high",
        )
        b64 = response.data[0].b64_json
        return jsonify({"b64_json": b64})
    except Exception as e:
        return jsonify({"detail": str(e)}), 500
