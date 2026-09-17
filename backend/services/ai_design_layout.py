"""AI layout planning for the print-checker design beta.

The model never renders final text into a bitmap. It returns a constrained vector
background recipe plus editable element placement. The browser keeps user text as
real editable layers and owns exact trim/bleed/spine geometry.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
DEFAULT_MODEL = "gpt-5.6-sol"
HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
MAX_TEXT = 500
MAX_STYLE = 1200
MAX_ELEMENTS = 12
MAX_SHAPES = 10


class AiDesignError(RuntimeError):
    def __init__(self, message: str, *, status_code: int = 502, code: str = "AI_DESIGN_FAILED"):
        super().__init__(message)
        self.status_code = status_code
        self.code = code


@dataclass(frozen=True)
class DesignRequest:
    document_type: str
    trim_width_mm: float
    trim_height_mm: float
    spine_mm: float
    bleed_mm: float
    fields: dict[str, str]
    has_logo: bool
    style_request: str


def _number(value: Any, *, minimum: float, maximum: float, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, number))


def _clean_text(value: Any, limit: int = MAX_TEXT) -> str:
    text = str(value or "").replace("\x00", " ").strip()
    return text[:limit]


def normalize_request(payload: dict[str, Any]) -> DesignRequest:
    document_type = _clean_text(payload.get("document_type"), 20).lower()
    if document_type not in {"cover", "poster"}:
        document_type = "cover"

    width = _number(payload.get("trim_width_mm"), minimum=50, maximum=1000, default=210)
    height = _number(payload.get("trim_height_mm"), minimum=50, maximum=1000, default=297)
    spine = _number(payload.get("spine_mm"), minimum=0, maximum=100, default=0)
    bleed = _number(payload.get("bleed_mm"), minimum=0, maximum=20, default=3)
    if document_type != "cover":
        spine = 0

    raw_fields = payload.get("fields") if isinstance(payload.get("fields"), dict) else {}
    allowed = (
        "title", "subtitle", "date", "venue", "target", "organizer",
        "host", "contact", "body", "back_text",
    )
    fields = {key: _clean_text(raw_fields.get(key)) for key in allowed}
    fields = {key: value for key, value in fields.items() if value}
    if not fields.get("title"):
        raise AiDesignError("제목을 입력해 주세요.", status_code=400, code="AI_DESIGN_TITLE_REQUIRED")

    style_request = _clean_text(payload.get("style_request"), MAX_STYLE)
    return DesignRequest(
        document_type=document_type,
        trim_width_mm=width,
        trim_height_mm=height,
        spine_mm=spine,
        bleed_mm=bleed,
        fields=fields,
        has_logo=bool(payload.get("has_logo")),
        style_request=style_request,
    )


def _schema() -> dict[str, Any]:
    element = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "id": {"type": "string", "enum": [
                "title", "subtitle", "date", "venue", "target", "organizer",
                "host", "contact", "body", "back_text", "logo", "spine_title",
            ]},
            "zone": {"type": "string", "enum": ["front", "back", "spine", "page"]},
            "x": {"type": "number", "minimum": 0, "maximum": 100},
            "y": {"type": "number", "minimum": 0, "maximum": 100},
            "w": {"type": "number", "minimum": 4, "maximum": 100},
            "h": {"type": "number", "minimum": 2, "maximum": 100},
            "font_size_pt": {"type": "number", "minimum": 7, "maximum": 80},
            "font_weight": {"type": "integer", "enum": [400, 500, 600, 700, 800, 900]},
            "align": {"type": "string", "enum": ["left", "center", "right"]},
            "color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
            "rotate": {"type": "number", "minimum": -180, "maximum": 180},
        },
        "required": [
            "id", "zone", "x", "y", "w", "h", "font_size_pt",
            "font_weight", "align", "color", "rotate",
        ],
    }
    shape = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "kind": {"type": "string", "enum": ["rect", "circle", "line", "band"]},
            "x": {"type": "number", "minimum": -20, "maximum": 120},
            "y": {"type": "number", "minimum": -20, "maximum": 120},
            "w": {"type": "number", "minimum": 1, "maximum": 160},
            "h": {"type": "number", "minimum": 1, "maximum": 160},
            "rotation": {"type": "number", "minimum": -180, "maximum": 180},
            "color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
            "opacity": {"type": "number", "minimum": 0.03, "maximum": 1},
        },
        "required": ["kind", "x", "y", "w", "h", "rotation", "color", "opacity"],
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "background": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "base_color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
                    "accent_colors": {
                        "type": "array", "minItems": 2, "maxItems": 4,
                        "items": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
                    },
                    "shapes": {"type": "array", "maxItems": MAX_SHAPES, "items": shape},
                },
                "required": ["base_color", "accent_colors", "shapes"],
            },
            "elements": {"type": "array", "maxItems": MAX_ELEMENTS, "items": element},
            "style_note": {"type": "string", "maxLength": 240},
        },
        "required": ["background", "elements", "style_note"],
    }


def _instructions() -> str:
    return (
        "You are a senior Korean print graphic designer. Plan a polished, production-aware layout. "
        "Do not rewrite user copy and do not invent event facts. The browser will render all text as editable layers. "
        "Your background must contain only abstract vector geometry: rectangles, circles, lines and bands; never embed text. "
        "Keep important text comfortably inside safe margins. Use strong hierarchy, restrained decoration, and practical readability. "
        "For cover spreads, front/back/spine zones are supplied by the application; position elements only within their zone. "
        "For posters use the page zone. If a logo exists, include a logo element. If spine width is usable, include spine_title. "
        "Return only the structured layout matching the provided schema."
    )


def _input_text(req: DesignRequest) -> str:
    facts = "\n".join(f"- {key}: {value}" for key, value in req.fields.items())
    if req.document_type == "cover":
        geometry = (
            f"book cover spread; each trim panel {req.trim_width_mm:.2f}×{req.trim_height_mm:.2f} mm; "
            f"spine {req.spine_mm:.2f} mm; bleed {req.bleed_mm:.2f} mm. "
            "The app calculates exact back/spine/front boundaries."
        )
    else:
        geometry = (
            f"single poster page {req.trim_width_mm:.2f}×{req.trim_height_mm:.2f} mm; "
            f"bleed {req.bleed_mm:.2f} mm."
        )
    return (
        f"Document: {geometry}\n"
        f"Logo uploaded: {'yes' if req.has_logo else 'no'}\n"
        f"User design direction: {req.style_request or 'clean, modern, professional, print-friendly'}\n"
        "User copy (preserve exactly; only choose hierarchy and placement):\n"
        f"{facts}\n"
        "Make one coherent design direction, not multiple alternatives."
    )


def _response_text(data: dict[str, Any]) -> str:
    direct = data.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    for item in data.get("output") or []:
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        for content in item.get("content") or []:
            if isinstance(content, dict) and content.get("type") == "output_text":
                text = content.get("text")
                if isinstance(text, str) and text.strip():
                    return text.strip()
    raise AiDesignError("AI 응답에서 레이아웃 데이터를 찾지 못했습니다.")


def _safe_color(value: Any, fallback: str) -> str:
    text = str(value or "")
    return text.upper() if HEX_COLOR.fullmatch(text) else fallback


def _clamp(value: Any, low: float, high: float, default: float) -> float:
    try:
        return max(low, min(high, float(value)))
    except (TypeError, ValueError):
        return default


def sanitize_layout(layout: dict[str, Any], req: DesignRequest) -> dict[str, Any]:
    background = layout.get("background") if isinstance(layout.get("background"), dict) else {}
    base = _safe_color(background.get("base_color"), "#F7F8FA")
    accents = [
        _safe_color(color, "#1F4E79")
        for color in (background.get("accent_colors") or [])[:4]
    ]
    while len(accents) < 2:
        accents.append("#1F4E79" if not accents else "#D9E6F2")

    shapes = []
    for raw in (background.get("shapes") or [])[:MAX_SHAPES]:
        if not isinstance(raw, dict):
            continue
        kind = raw.get("kind") if raw.get("kind") in {"rect", "circle", "line", "band"} else "rect"
        shapes.append({
            "kind": kind,
            "x": _clamp(raw.get("x"), -20, 120, 0),
            "y": _clamp(raw.get("y"), -20, 120, 0),
            "w": _clamp(raw.get("w"), 1, 160, 20),
            "h": _clamp(raw.get("h"), 1, 160, 20),
            "rotation": _clamp(raw.get("rotation"), -180, 180, 0),
            "color": _safe_color(raw.get("color"), accents[0]),
            "opacity": _clamp(raw.get("opacity"), 0.03, 1, 0.25),
        })

    valid_ids = set(req.fields)
    if req.has_logo:
        valid_ids.add("logo")
    if req.document_type == "cover" and req.spine_mm >= 4 and req.fields.get("title"):
        valid_ids.add("spine_title")

    elements = []
    seen = set()
    for raw in (layout.get("elements") or [])[:MAX_ELEMENTS]:
        if not isinstance(raw, dict):
            continue
        element_id = str(raw.get("id") or "")
        if element_id not in valid_ids or element_id in seen:
            continue
        seen.add(element_id)
        zone = str(raw.get("zone") or "")
        allowed_zones = {"front", "back", "spine"} if req.document_type == "cover" else {"page"}
        if zone not in allowed_zones:
            zone = "front" if req.document_type == "cover" else "page"
        elements.append({
            "id": element_id,
            "zone": zone,
            "x": _clamp(raw.get("x"), 0, 100, 10),
            "y": _clamp(raw.get("y"), 0, 100, 10),
            "w": _clamp(raw.get("w"), 4, 100, 80),
            "h": _clamp(raw.get("h"), 2, 100, 12),
            "font_size_pt": _clamp(raw.get("font_size_pt"), 7, 80, 14),
            "font_weight": int(raw.get("font_weight")) if raw.get("font_weight") in {400, 500, 600, 700, 800, 900} else 600,
            "align": raw.get("align") if raw.get("align") in {"left", "center", "right"} else "left",
            "color": _safe_color(raw.get("color"), "#172033"),
            "rotate": _clamp(raw.get("rotate"), -180, 180, 0),
        })

    # Ensure every supplied field remains editable even when the model omits one.
    missing = [key for key in req.fields if key not in seen]
    for index, key in enumerate(missing):
        elements.append({
            "id": key,
            "zone": "front" if req.document_type == "cover" else "page",
            "x": 10,
            "y": min(88, 12 + index * 9),
            "w": 80,
            "h": 8,
            "font_size_pt": 13 if key != "title" else 30,
            "font_weight": 700 if key in {"title", "subtitle"} else 500,
            "align": "left",
            "color": "#172033",
            "rotate": 0,
        })

    return {
        "background": {"base_color": base, "accent_colors": accents, "shapes": shapes},
        "elements": elements[:MAX_ELEMENTS],
        "style_note": _clean_text(layout.get("style_note"), 240),
    }


def generate_layout(payload: dict[str, Any], *, uid: str) -> dict[str, Any]:
    req = normalize_request(payload)
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise AiDesignError(
            "관리자 OpenAI API 키가 아직 서버에 설정되지 않았습니다.",
            status_code=503,
            code="OPENAI_API_KEY_MISSING",
        )

    model = os.environ.get("OPENAI_AI_DESIGN_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    body = {
        "model": model,
        "store": False,
        "reasoning": {"effort": "medium"},
        "instructions": _instructions(),
        "input": _input_text(req),
        "max_output_tokens": 4200,
        "text": {
            "verbosity": "low",
            "format": {
                "type": "json_schema",
                "name": "print_design_layout",
                "strict": True,
                "schema": _schema(),
            },
        },
        "prompt_cache_key": "program-studio-print-ai-design-v1",
        "safety_identifier": hashlib.sha256(uid.encode("utf-8")).hexdigest()[:32],
    }
    request = urllib.request.Request(
        OPENAI_RESPONSES_URL,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=55) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            error_data = json.loads(exc.read().decode("utf-8"))
            detail = str((error_data.get("error") or {}).get("message") or "")
        except Exception:
            pass
        if exc.code in {401, 403}:
            raise AiDesignError("OpenAI API 키 또는 프로젝트 권한을 확인해 주세요.", status_code=503, code="OPENAI_AUTH_FAILED") from exc
        if exc.code == 429:
            raise AiDesignError("AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.", status_code=429, code="OPENAI_RATE_LIMIT") from exc
        raise AiDesignError(
            f"OpenAI 디자인 요청에 실패했습니다.{(' ' + detail[:160]) if detail else ''}",
            status_code=502,
            code="OPENAI_REQUEST_FAILED",
        ) from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise AiDesignError("OpenAI 서버 응답을 받지 못했습니다. 다시 시도해 주세요.") from exc

    try:
        raw_layout = json.loads(_response_text(data))
    except json.JSONDecodeError as exc:
        raise AiDesignError("AI 레이아웃 응답 형식이 올바르지 않습니다.") from exc

    result = sanitize_layout(raw_layout, req)
    usage = data.get("usage") if isinstance(data.get("usage"), dict) else {}
    result["meta"] = {
        "model": str(data.get("model") or model),
        "input_tokens": int(usage.get("input_tokens") or 0),
        "output_tokens": int(usage.get("output_tokens") or 0),
    }
    return result
