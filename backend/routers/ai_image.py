from __future__ import annotations

import base64
import io
import json
import os
import socket
import urllib.error
import urllib.parse
import urllib.request
from functools import lru_cache
from typing import Any

from firebase_admin import firestore
from flask import Blueprint, jsonify, request
from PIL import Image

from utils.ai_logger import log_ai_usage
from utils.auth import require_auth

ai_image_bp = Blueprint("ai_image", __name__)

MAX_PROMPT_CHARS = 12000
UPSTREAM_TIMEOUT_SEC = 240
MIN_TARGET_RATIO = 0.2
MAX_TARGET_RATIO = 5.0


class UpstreamError(Exception):
    def __init__(self, provider: str, status: int, message: str):
        super().__init__(message)
        self.provider = provider
        self.status = status
        self.message = message


@lru_cache(maxsize=1)
def _db():
    return firestore.client()


def _admin_ai_config() -> dict[str, Any]:
    """Read the AI keys and provider choices saved by admin.html."""
    try:
        snap = _db().collection("settings").document("config").get()
        return (snap.to_dict() or {}) if snap.exists else {}
    except Exception:
        return {}


def _provider_key(provider: str, config: dict[str, Any]) -> str | None:
    if provider == "openai":
        return str(config.get("openaiApiKey") or "").strip() or os.environ.get("OPENAI_API_KEY")
    return (
        str(config.get("googleApiKey") or config.get("openaiKey") or "").strip()
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_GENAI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
    )


def _admin_image_provider(config: dict[str, Any]) -> str:
    providers = config.get("aiProviders") or {}
    if isinstance(providers, dict):
        value = str(providers.get("image") or "").strip().lower()
        if value in ("google", "openai"):
            return value
    return "google"


def _extract_error_message(raw: bytes, fallback: str) -> str:
    try:
        data = json.loads(raw.decode("utf-8", errors="replace"))
        error = data.get("error")
        if isinstance(error, dict):
            return str(error.get("message") or error.get("status") or fallback)[:800]
        if isinstance(error, str):
            return error[:800]
        return str(data.get("detail") or data.get("message") or fallback)[:800]
    except Exception:
        text = raw.decode("utf-8", errors="replace").strip()
        return (text or fallback)[:800]


def _post_json(provider: str, url: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT_SEC) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read() if exc.fp else b""
        raise UpstreamError(
            provider,
            int(exc.code or 502),
            _extract_error_message(raw, f"{provider} 이미지 생성 요청이 거절되었습니다"),
        ) from exc
    except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
        raise UpstreamError(provider, 504, f"{provider} 이미지 생성 서버 응답 시간이 초과되었습니다") from exc
    except json.JSONDecodeError as exc:
        raise UpstreamError(provider, 502, f"{provider} 이미지 생성 응답 형식이 올바르지 않습니다") from exc


def _safe_positive_float(value: Any, fallback: float = 0.0) -> float:
    try:
        result = float(value)
        return result if result > 0 else fallback
    except Exception:
        return fallback


def _target_ratio(data: dict[str, Any], aspect: str) -> float:
    width_mm = _safe_positive_float(data.get("width_mm"))
    height_mm = _safe_positive_float(data.get("height_mm"))
    requested = _safe_positive_float(data.get("target_ratio"))
    ratio = requested or (width_mm / height_mm if width_mm and height_mm else 0.0)
    if not ratio:
        ratio = {"wide": 16 / 9, "tall": 9 / 16, "square": 1.0}.get(aspect, 1.0)
    return max(MIN_TARGET_RATIO, min(MAX_TARGET_RATIO, ratio))


def _closest_google_aspect(target_ratio: float) -> str:
    options = {
        "9:16": 9 / 16,
        "3:4": 3 / 4,
        "1:1": 1.0,
        "4:3": 4 / 3,
        "16:9": 16 / 9,
    }
    return min(options, key=lambda key: abs(options[key] - target_ratio))


def _openai_size(target_ratio: float) -> str:
    if target_ratio > 1.12:
        return "1536x1024"
    if target_ratio < 0.89:
        return "1024x1536"
    return "1024x1024"


def _generate_openai(prompt: str, target_ratio: float, api_key: str) -> tuple[str, str]:
    model = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
    payload = {
        "model": model,
        "prompt": prompt,
        "size": _openai_size(target_ratio),
        "quality": os.environ.get("OPENAI_IMAGE_QUALITY", "medium"),
        "output_format": "png",
    }
    data = _post_json(
        "OpenAI",
        "https://api.openai.com/v1/images/generations",
        payload,
        {"Authorization": f"Bearer {api_key}"},
    )
    images = data.get("data") or []
    if not images or not isinstance(images[0], dict) or not images[0].get("b64_json"):
        raise UpstreamError("OpenAI", 502, "OpenAI 응답에 생성된 이미지가 없습니다")
    return str(images[0]["b64_json"]), "image/png"


def _generate_google(prompt: str, target_ratio: float, api_key: str) -> tuple[str, str]:
    model = os.environ.get("GOOGLE_IMAGE_MODEL", "imagen-4.0-generate-001")
    encoded_model = urllib.parse.quote(model, safe=".-_")
    payload = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": _closest_google_aspect(target_ratio),
            "personGeneration": "allow_adult",
        },
    }
    data = _post_json(
        "Google Imagen",
        f"https://generativelanguage.googleapis.com/v1beta/models/{encoded_model}:predict",
        payload,
        {"x-goog-api-key": api_key},
    )
    predictions = data.get("predictions") or []
    for prediction in predictions:
        if not isinstance(prediction, dict):
            continue
        image = prediction.get("bytesBase64Encoded") or prediction.get("bytes_base64_encoded")
        if image:
            return str(image), str(prediction.get("mimeType") or prediction.get("mime_type") or "image/png")
    raise UpstreamError("Google Imagen", 502, "Google Imagen 응답에 생성된 이미지가 없습니다")


def _crop_to_exact_ratio(image_b64: str, target_ratio: float) -> tuple[str, str, int, int]:
    """Center-crop generated artwork to the exact requested paper ratio.

    Image providers only offer a small set of generation ratios. Cropping on the
    server guarantees the background returned to Design Studio has the same ratio
    as the real paper/spread including bleed.
    """
    try:
        raw = base64.b64decode(image_b64)
        with Image.open(io.BytesIO(raw)) as source:
            source.load()
            image = source.convert("RGB")

        width, height = image.size
        if width < 2 or height < 2:
            raise ValueError("생성 이미지 크기가 올바르지 않습니다")

        current_ratio = width / height
        if current_ratio > target_ratio:
            crop_width = max(1, min(width, round(height * target_ratio)))
            left = max(0, (width - crop_width) // 2)
            image = image.crop((left, 0, left + crop_width, height))
        elif current_ratio < target_ratio:
            crop_height = max(1, min(height, round(width / target_ratio)))
            top = max(0, (height - crop_height) // 2)
            image = image.crop((0, top, width, top + crop_height))

        output = io.BytesIO()
        image.save(output, format="PNG", optimize=True)
        final_width, final_height = image.size
        encoded = base64.b64encode(output.getvalue()).decode("ascii")
        return encoded, "image/png", final_width, final_height
    except Exception as exc:
        raise UpstreamError("AI", 502, f"생성 이미지를 용지 비율에 맞추지 못했습니다: {type(exc).__name__}") from exc


@ai_image_bp.route("/generate-bg", methods=["POST"])
@require_auth
def generate_background(uid: str):
    data = request.get_json(silent=True) or {}
    prompt = str(data.get("prompt") or "").strip()
    requested_provider = str(data.get("provider") or "").strip().lower()
    aspect = str(data.get("aspect") or "square").strip().lower()

    if not prompt:
        return jsonify({"detail": "배경 분위기 또는 디자인 설명을 입력해주세요"}), 400
    if len(prompt) > MAX_PROMPT_CHARS:
        return jsonify({"detail": f"AI 배경 요청 문구는 {MAX_PROMPT_CHARS:,}자 이하여야 합니다"}), 400
    if requested_provider and requested_provider not in ("google", "openai"):
        return jsonify({"detail": "지원하지 않는 AI 모델입니다"}), 400
    if aspect not in ("wide", "tall", "square"):
        aspect = "square"

    target_ratio = _target_ratio(data, aspect)
    width_mm = _safe_positive_float(data.get("width_mm"))
    height_mm = _safe_positive_float(data.get("height_mm"))

    config = _admin_ai_config()
    admin_provider = _admin_image_provider(config)
    provider = requested_provider or admin_provider
    api_key = _provider_key(provider, config)

    if not api_key and provider != admin_provider:
        admin_key = _provider_key(admin_provider, config)
        if admin_key:
            provider, api_key = admin_provider, admin_key
    if not api_key:
        fallback = "openai" if provider == "google" else "google"
        fallback_key = _provider_key(fallback, config)
        if fallback_key:
            provider, api_key = fallback, fallback_key

    if not api_key:
        return jsonify({
            "detail": "관리자페이지에 Google 또는 OpenAI API 키가 등록되어 있지 않습니다. 관리자 설정의 AI API 키를 확인해주세요."
        }), 503

    try:
        if provider == "openai":
            generated_b64, generated_mime = _generate_openai(prompt, target_ratio, api_key)
        else:
            generated_b64, generated_mime = _generate_google(prompt, target_ratio, api_key)

        b64_json, mime_type, output_width, output_height = _crop_to_exact_ratio(generated_b64, target_ratio)
        log_ai_usage(uid, "design_studio_background")
        return jsonify({
            "b64_json": b64_json,
            "mime_type": mime_type,
            "provider": provider,
            "requested_provider": requested_provider or admin_provider,
            "admin_provider": admin_provider,
            "width_mm": width_mm or None,
            "height_mm": height_mm or None,
            "target_ratio": target_ratio,
            "source_mime_type": generated_mime,
            "output_width": output_width,
            "output_height": output_height,
        })
    except UpstreamError as exc:
        status = 429 if exc.status == 429 else 502 if exc.status < 500 else min(exc.status, 504)
        return jsonify({"detail": f"{exc.provider} AI 배경 생성 실패: {exc.message}"}), status
    except Exception as exc:
        return jsonify({"detail": f"AI 배경 생성 중 오류가 발생했습니다: {type(exc).__name__}"}), 500
