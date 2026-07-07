import os
from functools import lru_cache

import anthropic
from firebase_admin import firestore
from flask import Blueprint, jsonify, request

from utils.ai_logger import log_ai_usage
from utils.auth import require_auth

writing_bp = Blueprint("writing", __name__)


@lru_cache(maxsize=1)
def _db():
    return firestore.client()


def get_writing_api_key():
    try:
        doc = _db().collection("settings").document("config").get()
        data = doc.to_dict() if doc.exists else {}
        key = str((data or {}).get("anthropicApiKey") or "").strip()
        if key:
            return key
    except Exception:
        pass
    return os.environ.get("ANTHROPIC_API_KEY")


@writing_bp.route("/generate", methods=["POST"])
@require_auth
def generate(uid):
    data = request.get_json(silent=True) or {}
    content_type = str(data.get("content_type", "이메일"))[:80]
    tone = str(data.get("tone", "전문적"))[:80]
    length = data.get("length", "medium")
    topic = str(data.get("topic", ""))[:1000]
    context = str(data.get("context", ""))[:4000]

    if not topic.strip():
        return jsonify({"detail": "주제/키워드를 입력해주세요"}), 400

    api_key = get_writing_api_key()
    if not api_key:
        return jsonify({"detail": "AI 글쓰기 API 키가 설정되지 않았습니다. 관리자 설정을 확인해주세요."}), 500

    length_guide = {
        "short": "200자 이내",
        "medium": "400~600자",
        "long": "800자 이상",
    }.get(length, "400~600자")

    prompt = f"""당신은 한국어 전문 카피라이터입니다.
다음 조건에 맞는 {content_type}을 작성해주세요.

- 문체/톤: {tone}
- 길이: {length_guide}
- 주제/키워드: {topic}
{"- 추가 정보: " + context if context else ""}

바로 본문만 작성해주세요. 설명이나 제목 없이 내용만 작성합니다."""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=os.environ.get("ANTHROPIC_TEXT_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        result = message.content[0].text
        log_ai_usage(uid, "writing")
        return jsonify({"result": result, "provider": "anthropic"})
    except Exception as e:
        return jsonify({"detail": f"AI 생성 중 오류가 발생했습니다: {type(e).__name__}"}), 500
