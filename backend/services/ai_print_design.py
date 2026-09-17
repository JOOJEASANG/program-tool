"""OpenAI-backed layout and background generation for print-checker AI design.

The AI never renders user copy into the background image. User text remains editable
in the browser and is positioned from structured layout data returned by GPT-5.6 Sol.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import urllib.error
import urllib.request
from typing import Any


OPENAI_API_BASE = "https://api.openai.com/v1"
DEFAULT_TEXT_MODEL = "gpt-5.6-sol"
DEFAULT_IMAGE_MODEL = "gpt-image-2.5-sunburst"

_ALLOWED_FIELDS = (
    "title",
    "subtitle",
    "body",
    "date",
    "place",
    "target",
    "host",
    "organizer",
    "operator",
    "contact",
    "logo",
    "spine_title",
)
_ALLOWED_ZONES = ("page", "front", "back", "spine")


class OpenAIServiceError(RuntimeError):
    def __init__(self, message: str, *, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


def _api_key() -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise OpenAIServiceError(
            "AI 디자인 기능의 OpenAI API 키가 서버에 설정되지 않았습니다.",
            status_code=503,
        )
    return key


def _post_json(path: str, payload: dict[str, Any], *, timeout: int = 150) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{OPENAI_API_BASE}{path}",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {_api_key()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")[:4000]
        try:
            data = json.loads(raw)
            detail = data.get("error", {}).get("message") or raw
        except Exception:
            detail = raw
        raise OpenAIServiceError(
            f"OpenAI 요청이 실패했습니다: {detail or exc.reason}",
            status_code=502,
        ) from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise OpenAIServiceError("OpenAI 서버 연결 시간이 초과되었습니다. 다시 시도해 주세요.") from exc
    except json.JSONDecodeError as exc:
        raise OpenAIServiceError("OpenAI 응답 형식을 읽을 수 없습니다.") from exc


def _response_text(response: dict[str, Any]) -> str:
    for item in response.get("output") or []:
        if item.get("type") != "message":
            continue
        for content in item.get("content") or []:
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                return content["text"]
    raise OpenAIServiceError("AI 레이아웃 응답에 구조화된 결과가 없습니다.")


def _layout_schema() -> dict[str, Any]:
    element = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "field": {"type": "string", "enum": list(_ALLOWED_FIELDS)},
            "zone": {"type": "string", "enum": list(_ALLOWED_ZONES)},
            "x_pct": {"type": "number", "minimum": 0, "maximum": 1},
            "y_pct": {"type": "number", "minimum": 0, "maximum": 1},
            "w_pct": {"type": "number", "minimum": 0.05, "maximum": 1},
            "h_pct": {"type": "number", "minimum": 0.02, "maximum": 1},
            "font_size_pt": {"type": "number", "minimum": 6, "maximum": 72},
            "font_weight": {"type": "integer", "enum": [400, 500, 600, 700, 800, 900]},
            "align": {"type": "string", "enum": ["left", "center", "right"]},
            "color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
            "letter_spacing_em": {"type": "number", "minimum": -0.08, "maximum": 0.25},
            "line_height": {"type": "number", "minimum": 0.9, "maximum": 2.0},
        },
        "required": [
            "field", "zone", "x_pct", "y_pct", "w_pct", "h_pct",
            "font_size_pt", "font_weight", "align", "color",
            "letter_spacing_em", "line_height",
        ],
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "background_prompt": {"type": "string", "minLength": 20, "maxLength": 1800},
            "palette": {
                "type": "array",
                "minItems": 3,
                "maxItems": 5,
                "items": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
            },
            "elements": {"type": "array", "minItems": 1, "maxItems": 16, "items": element},
        },
        "required": ["background_prompt", "palette", "elements"],
    }


def _safe_identifier(uid: str) -> str:
    return hashlib.sha256(str(uid or "anonymous").encode("utf-8")).hexdigest()[:32]


def _nonempty_fields(data: dict[str, Any]) -> dict[str, str]:
    fields = data.get("fields") if isinstance(data.get("fields"), dict) else {}
    return {
        key: str(value).strip()
        for key, value in fields.items()
        if key in _ALLOWED_FIELDS and isinstance(value, str) and value.strip()
    }


def _layout_instructions(data: dict[str, Any]) -> str:
    document_type = data.get("document_type", "poster")
    width = float(data.get("width_mm", 210))
    height = float(data.get("height_mm", 297))
    spine = float(data.get("spine_mm", 0))
    bleed = float(data.get("bleed_mm", 3))
    safe = float(data.get("safe_mm", 10))
    fields = _nonempty_fields(data)
    style = str(data.get("style_prompt") or "깔끔하고 전문적인 인쇄 디자인").strip()

    if document_type == "cover":
        zones = (
            f"뒤표지 {width:.2f}mm + 책등 {spine:.2f}mm + 앞표지 {width:.2f}mm, "
            f"완성 높이 {height:.2f}mm, 사방 도련 {bleed:.2f}mm. "
            "title/subtitle/date/place/target/host/organizer/operator/contact/logo는 특별한 이유가 없으면 front에 배치하고, "
            "body는 back 사용 가능. spine_title은 책등이 4mm 이상일 때만 spine에 배치한다."
        )
    else:
        zones = f"단면 page {width:.2f}×{height:.2f}mm, 사방 도련 {bleed:.2f}mm. 모든 요소는 page에 배치한다."

    return f"""
당신은 상업 인쇄물의 레이아웃 디렉터다. 최종 글자를 이미지로 만들지 말고, 사용자가 입력한 원문을 나중에 브라우저에서 편집 가능한 텍스트 레이어로 올릴 수 있도록 배치 데이터만 설계한다.

문서 종류: {document_type}
인쇄 규격: {zones}
안전여백: 재단선 안쪽 {safe:.2f}mm
사용자 디자인 요구: {style}
사용자 입력 필드(JSON): {json.dumps(fields, ensure_ascii=False)}

규칙:
1. 입력 문구를 고치거나 요약하지 않는다. 문구 자체를 출력할 필요도 없다. field 이름만 배치한다.
2. x_pct/y_pct/w_pct/h_pct는 각 zone 내부의 0~1 비율이다. 중요한 글자와 로고는 안전여백에 해당하는 여유를 둔다.
3. title을 가장 강하게, subtitle과 주요 정보는 명확한 계층으로, host/organizer/operator/contact는 하단 정보군으로 정돈한다.
4. 실제 값이 비어 있는 field는 elements에 넣지 않는다. logo는 사용자가 로고를 업로드할 가능성이 있으므로 fields.logo 값이 있을 때만 넣는다.
5. cover의 앞표지/뒤표지/책등 경계를 침범하지 않는다.
6. background_prompt는 '배경 그래픽 전용' 프롬프트다. 절대로 글자, 숫자, 한글, 영문, 로고, QR, 워터마크, 간판, 표지판을 생성하지 않도록 명시하고, 텍스트가 올라갈 영역에는 충분한 시각적 여백을 남긴다.
7. 배경은 인쇄물로 사용할 수 있게 고급스럽고 절제되어야 하며, 사용자 요구와 정보량을 반영한다.
""".strip()


def generate_layout(data: dict[str, Any], *, uid: str = "") -> dict[str, Any]:
    model = (os.environ.get("OPENAI_DESIGN_MODEL") or DEFAULT_TEXT_MODEL).strip()
    payload = {
        "model": model,
        "instructions": "Return only the structured print layout requested by the supplied JSON schema.",
        "input": _layout_instructions(data),
        "reasoning": {"effort": "high"},
        "max_output_tokens": 5000,
        "store": False,
        "safety_identifier": _safe_identifier(uid),
        "text": {
            "verbosity": "low",
            "format": {
                "type": "json_schema",
                "name": "print_design_layout",
                "strict": True,
                "schema": _layout_schema(),
            },
        },
    }
    response = _post_json("/responses", payload, timeout=150)
    try:
        layout = json.loads(_response_text(response))
    except json.JSONDecodeError as exc:
        raise OpenAIServiceError("AI 레이아웃 JSON을 해석하지 못했습니다.") from exc
    layout["model"] = model
    layout["usage"] = response.get("usage") or {}
    return layout


def _image_size(width_mm: float, height_mm: float, document_type: str, spine_mm: float) -> str:
    actual_width = width_mm * (2 if document_type == "cover" else 1) + (spine_mm if document_type == "cover" else 0)
    ratio = actual_width / max(height_mm, 1)
    if ratio >= 1.15:
        return "1536x1024"
    if ratio <= 0.87:
        return "1024x1536"
    return "1024x1024"


def _download_as_base64(url: str) -> str:
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            return base64.b64encode(response.read()).decode("ascii")
    except Exception as exc:
        raise OpenAIServiceError("생성된 배경 이미지를 가져오지 못했습니다.") from exc


def generate_background(data: dict[str, Any], *, uid: str = "") -> dict[str, Any]:
    del uid  # reserved for future per-user image telemetry without exposing identity
    model = (os.environ.get("OPENAI_IMAGE_MODEL") or DEFAULT_IMAGE_MODEL).strip()
    width = float(data.get("width_mm", 210))
    height = float(data.get("height_mm", 297))
    spine = float(data.get("spine_mm", 0))
    document_type = str(data.get("document_type") or "poster")
    quality = str(data.get("quality") or "high").lower()
    if quality not in {"medium", "high"}:
        quality = "high"
    size = _image_size(width, height, document_type, spine)
    supplied_prompt = str(data.get("background_prompt") or "").strip()[:2200]
    style = str(data.get("style_prompt") or "깔끔하고 전문적인 인쇄 디자인").strip()[:700]

    prompt = f"""
상업 인쇄용 배경 그래픽만 제작한다. 완성 결과에는 어떠한 글자도 넣지 않는다.
절대 금지: 한글, 영문, 숫자, 타이포그래피, 로고, QR 코드, 워터마크, 간판, 표지판, 가짜 문자, 읽을 수 있는 기호.
문서: {'책/보고서 펼침 표지' if document_type == 'cover' else '행사 포스터'}
스타일 요구: {style}
레이아웃 디렉터의 배경 지시: {supplied_prompt}
정보 텍스트가 별도 레이어로 올라갈 것이므로 중심부와 주요 정보 영역은 복잡한 피사체나 강한 대비를 피하고 충분한 음영 여백을 둔다.
책 표지라면 앞표지/책등/뒤표지가 하나의 연속된 배경처럼 자연스럽게 이어지되 책등 중앙에 핵심 피사체를 두지 않는다.
최종 결과는 인쇄 디자인의 배경으로 사용할 수 있는 정돈된 그래픽이어야 한다.
""".strip()

    payload = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": size,
        "quality": quality,
        "output_format": "webp",
        "output_compression": 88,
        "background": "opaque",
    }
    response = _post_json("/images/generations", payload, timeout=180)
    images = response.get("data") or []
    if not images:
        raise OpenAIServiceError("AI 배경 이미지가 생성되지 않았습니다.")
    image = images[0]
    encoded = image.get("b64_json")
    if not encoded and image.get("url"):
        encoded = _download_as_base64(str(image["url"]))
    if not encoded:
        raise OpenAIServiceError("AI 배경 이미지 데이터를 찾을 수 없습니다.")
    return {
        "image_data_url": f"data:image/webp;base64,{encoded}",
        "model": model,
        "size": response.get("size") or size,
        "quality": response.get("quality") or quality,
        "usage": response.get("usage") or {},
    }
