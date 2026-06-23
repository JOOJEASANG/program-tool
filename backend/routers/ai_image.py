from __future__ import annotations

import json
import os
import socket
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from flask import Blueprint, jsonify, request

from utils.ai_logger import log_ai_usage
from utils.auth import require_auth

ai_image_bp = Blueprint("ai_image", __name__)

MAX_PROMPT_CHARS = 12000
UPSTREAM_TIMEOUT_SEC = 240


class UpstreamError(Exception):
    def __init__(self, provider: str, status: int, message: str):
        super().__init__(message)
        self.provider = provider
        self.status = status
        self.message = message


def _provider_key(provider: str) -> str | None:
    if provider == "openai":
        return os.environ.get("OPENAI_API_KEY")
    return (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_GENAI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
    )


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


def _aspect_ratio(aspect: str) -> str:
    return {"wide": "16:9", "tall": "9:16", "square": "1:1"}.get(aspect, "1:1")


def _openai_size(aspect: str) -> str:
    return {"wide": "1536x1024", "tall": "1024x1536", "square": "1024x1024"}.get(aspect, "1024x1024")


def _generate_openai(prompt: str, aspect: str, api_key: str) -> tuple[str, str]:
    model = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2")
    payload = {
        "model": model,
        "prompt": prompt,
        "size": _openai_size(aspect),
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


def _generate_gemini(prompt: str, aspect: str, api_key: str) -> tuple[str, str]:
    model = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")
    encoded_model = urllib.parse.quote(model, safe=".-_")
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "responseFormat": {
                "image": {
                    "aspectRatio": _aspect_ratio(aspect),
                    "imageSize": os.environ.get("GEMINI_IMAGE_SIZE", "1K"),
                }
            },
        },
    }
    data = _post_json(
        "Gemini",
        f"https://generativelanguage.googleapis.com/v1/models/{encoded_model}:generateContent",
        payload,
        {"x-goog-api-key": api_key},
    )
    for candidate in data.get("candidates") or []:
        content = candidate.get("content") if isinstance(candidate, dict) else None
        for part in (content or {}).get("parts") or []:
            if not isinstance(part, dict):
                continue
            inline = part.get("inlineData") or part.get("inline_data")
            if isinstance(inline, dict) and inline.get("data"):
                mime_type = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return str(inline["data"]), str(mime_type)
    raise UpstreamError("Gemini", 502, "Gemini 응답에 생성된 이미지가 없습니다")


@ai_image_bp.route("/generate-bg", methods=["POST"])
@require_auth
def generate_background(uid: str):
    data = request.get_json(silent=True) or {}
    prompt = str(data.get("prompt") or "").strip()
    provider = str(data.get("provider") or "google").strip().lower()
    aspect = str(data.get("aspect") or "square").strip().lower()

    if not prompt:
        return jsonify({"detail": "배경 분위기 또는 디자인 설명을 입력해주세요"}), 400
    if len(prompt) > MAX_PROMPT_CHARS:
        return jsonify({"detail": f"AI 배경 요청 문구는 {MAX_PROMPT_CHARS:,}자 이하여야 합니다"}), 400
    if provider not in ("google", "openai"):
        return jsonify({"detail": "지원하지 않는 AI 모델입니다"}), 400
    if aspect not in ("wide", "tall", "square"):
        aspect = "square"

    requested_provider = provider
    api_key = _provider_key(provider)

    # Keep the feature usable when only one image provider is configured.
    if not api_key:
        fallback = "openai" if provider == "google" else "google"
        fallback_key = _provider_key(fallback)
        if fallback_key:
            provider, api_key = fallback, fallback_key
        else:
            return jsonify({
                "detail": "AI 배경 생성 API 키가 설정되지 않았습니다. GEMINI_API_KEY 또는 OPENAI_API_KEY를 Functions 환경에 등록해주세요."
            }), 503

    try:
        if provider == "openai":
            b64_json, mime_type = _generate_openai(prompt, aspect, api_key)
        else:
            b64_json, mime_type = _generate_gemini(prompt, aspect, api_key)
        log_ai_usage(uid, "design_studio_background")
        return jsonify({
            "b64_json": b64_json,
            "mime_type": mime_type,
            "provider": provider,
            "requested_provider": requested_provider,
        })
    except UpstreamError as exc:
        status = 429 if exc.status == 429 else 502 if exc.status < 500 else min(exc.status, 504)
        return jsonify({"detail": f"{exc.provider} AI 배경 생성 실패: {exc.message}"}), status
    except Exception as exc:
        return jsonify({"detail": f"AI 배경 생성 중 오류가 발생했습니다: {type(exc).__name__}"}), 500
