import os
import base64
from flask import Blueprint, request, jsonify
from google import genai
from google.genai import types
from utils.auth import require_auth

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/generate-bg", methods=["POST"])
@require_auth
def generate_bg(uid):
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return jsonify({"detail": "GOOGLE_API_KEY가 설정되지 않았습니다."}), 500

    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    if not prompt:
        return jsonify({"detail": "프롬프트가 없습니다."}), 400

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="4:3",
                safety_filter_level="block_low_and_above",
                person_generation="allow_adult",
            ),
        )
        img_bytes = response.generated_images[0].image.image_bytes
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        return jsonify({"b64_json": b64})
    except Exception as e:
        return jsonify({"detail": str(e)}), 500
