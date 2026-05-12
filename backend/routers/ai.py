import base64
from flask import Blueprint, request, jsonify
from utils.auth import require_auth
from utils.api_key import get_google_api_key, get_openai_api_key, get_ai_provider
from utils.ai_logger import log_ai_usage

ai_bp = Blueprint("ai", __name__)


def _is_cover_request(prompt: str, data: dict) -> bool:
    text = f"{prompt} {data.get('template', '')} {data.get('design_type', '')}".lower()
    cover_words = ("표지", "책등", "앞표지", "뒷표지", "cover", "spine", "book cover")
    return bool(data.get("cover_spread")) or any(word in text for word in cover_words)


def _generate_with_google(prompt: str, aspect: str) -> bytes:
    from google import genai
    from google.genai import types
    api_key = get_google_api_key()
    if not api_key:
        raise RuntimeError("Google API 키가 설정되지 않았습니다. 관리자 페이지에서 키를 등록해 주세요.")
    aspect_ratio = "16:9" if aspect == "wide" else "9:16" if aspect == "tall" else "4:3"
    client = genai.Client(api_key=api_key)
    response = client.models.generate_images(
        model="imagen-4.0-generate-001",
        prompt=prompt,
        config=types.GenerateImagesConfig(
            number_of_images=1,
            aspect_ratio=aspect_ratio,
            safety_filter_level="block_low_and_above",
            person_generation="allow_adult",
        ),
    )
    return response.generated_images[0].image.image_bytes


def _generate_with_openai(prompt: str, aspect: str) -> bytes:
    from openai import OpenAI
    api_key = get_openai_api_key()
    if not api_key:
        raise RuntimeError("OpenAI API 키가 설정되지 않았습니다. 관리자 페이지에서 키를 등록해 주세요.")
    size = "1536x1024" if aspect == "wide" else "1024x1536" if aspect == "tall" else "1024x1024"
    client = OpenAI(api_key=api_key)
    res = client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size=size,
        n=1,
    )
    return base64.b64decode(res.data[0].b64_json)


@ai_bp.route("/generate-bg", methods=["POST"])
@require_auth
def generate_bg(uid):
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    aspect = (data.get("aspect") or "").strip().lower()
    provider_req = (data.get("provider") or "").strip().lower()
    if not prompt:
        return jsonify({"detail": "프롬프트가 없습니다."}), 400

    if _is_cover_request(prompt, data):
        return jsonify({
            "detail": "표지 디자인 AI 배경 생성 기능은 제거되었습니다. 배경 이미지를 업로드해서 사용하세요."
        }), 410

    # Allow per-request provider override; fall back to system setting
    provider = provider_req if provider_req in ("google", "openai") else get_ai_provider("image")
    try:
        if provider == "openai":
            img_bytes = _generate_with_openai(prompt, aspect)
        else:
            img_bytes = _generate_with_google(prompt, aspect)
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        log_ai_usage(uid, f"image_{provider}")
        return jsonify({"b64_json": b64, "provider": provider})
    except Exception as e:
        return jsonify({"detail": str(e)}), 500
