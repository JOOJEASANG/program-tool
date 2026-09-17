"""AI-generated background artwork for print cover spreads.

The image model creates background artwork only. Exact Korean copy, spine text,
company names, dates and other typography are rendered by the browser as editable
vector-like text layers so print output remains accurate and controllable.
"""
from __future__ import annotations

import hashlib
import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations"
DEFAULT_IMAGE_MODEL = "gpt-image-2"
DEFAULT_IMAGE_QUALITY = "high"
MAX_STYLE = 2200
MAX_CONTEXT = 900


class AiCoverImageError(RuntimeError):
    def __init__(self, message: str, *, status_code: int = 502, code: str = "AI_COVER_IMAGE_FAILED"):
        super().__init__(message)
        self.status_code = status_code
        self.code = code


@dataclass(frozen=True)
class CoverImageRequest:
    trim_width_mm: float
    trim_height_mm: float
    spine_mm: float
    bleed_mm: float
    style_request: str
    theme_context: str
    preset_name: str

    @property
    def work_width_mm(self) -> float:
        return self.trim_width_mm * 2 + self.spine_mm + self.bleed_mm * 2

    @property
    def work_height_mm(self) -> float:
        return self.trim_height_mm + self.bleed_mm * 2


def _number(value: Any, *, minimum: float, maximum: float, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, number))


def _clean(value: Any, limit: int) -> str:
    return str(value or "").replace("\x00", " ").strip()[:limit]


def normalize_cover_request(payload: dict[str, Any]) -> CoverImageRequest:
    trim_width = _number(payload.get("trim_width_mm"), minimum=50, maximum=1000, default=210)
    trim_height = _number(payload.get("trim_height_mm"), minimum=50, maximum=1000, default=297)
    spine = _number(payload.get("spine_mm"), minimum=0, maximum=100, default=0)
    bleed = _number(payload.get("bleed_mm"), minimum=0, maximum=20, default=3)
    style_request = _clean(payload.get("style_request"), MAX_STYLE)
    theme_context = _clean(payload.get("theme_context"), MAX_CONTEXT)
    preset_name = _clean(payload.get("preset_name"), 80)
    if not style_request:
        raise AiCoverImageError(
            "디자인 스타일을 선택하거나 입력해 주세요.",
            status_code=400,
            code="AI_COVER_STYLE_REQUIRED",
        )

    request = CoverImageRequest(
        trim_width_mm=trim_width,
        trim_height_mm=trim_height,
        spine_mm=spine,
        bleed_mm=bleed,
        style_request=style_request,
        theme_context=theme_context,
        preset_name=preset_name,
    )
    ratio = request.work_width_mm / request.work_height_mm
    if ratio < (1 / 3) or ratio > 3:
        raise AiCoverImageError(
            "전체 펼침 표지 비율이 이미지 생성 지원 범위를 벗어났습니다.",
            status_code=400,
            code="AI_COVER_RATIO_UNSUPPORTED",
        )
    return request


def _multiple_of_16(value: float, *, minimum: int = 512, maximum: int = 3840) -> int:
    rounded = int(round(value / 16.0) * 16)
    return max(minimum, min(maximum, rounded))


def choose_image_size(req: CoverImageRequest) -> str:
    """Return a high-resolution gpt-image-2 size inside the documented limits.

    gpt-image-2 requires both edges to be multiples of 16, each edge <= 3840,
    a long/short edge ratio <= 3:1, and total pixels <= 8,294,400.
    """
    ratio = req.work_width_mm / req.work_height_mm
    long_edge = 3840
    short_edge = 2160
    if ratio >= 1:
        height = min(short_edge, long_edge / ratio)
        width = height * ratio
        width = _multiple_of_16(width, minimum=1024, maximum=long_edge)
        height = _multiple_of_16(width / ratio, minimum=1024, maximum=short_edge)
        width = _multiple_of_16(height * ratio, minimum=1024, maximum=long_edge)
    else:
        width = min(short_edge, long_edge * ratio)
        height = width / ratio
        height = _multiple_of_16(height, minimum=1024, maximum=long_edge)
        width = _multiple_of_16(height * ratio, minimum=1024, maximum=short_edge)
        height = _multiple_of_16(width / ratio, minimum=1024, maximum=long_edge)
    return f"{width}x{height}"


def build_cover_prompt(req: CoverImageRequest) -> str:
    spine_share = req.spine_mm / req.work_width_mm * 100 if req.work_width_mm else 0
    front_start = (req.bleed_mm + req.trim_width_mm + req.spine_mm) / req.work_width_mm * 100
    back_end = (req.bleed_mm + req.trim_width_mm) / req.work_width_mm * 100
    return f"""
Create a premium, production-ready FULL SPREAD PRINT COVER BACKGROUND viewed perfectly flat and straight-on.
This is not a mockup and not a photo of a physical book. It is the actual 2D artwork background for printing.

GEOMETRY
- Total spread including bleed: {req.work_width_mm:.2f} × {req.work_height_mm:.2f} mm.
- Left area: back cover, trim width {req.trim_width_mm:.2f} mm.
- Center area: spine, width {req.spine_mm:.2f} mm, about {spine_share:.2f}% of the full spread.
- Right area: front cover, trim width {req.trim_width_mm:.2f} mm.
- Bleed: {req.bleed_mm:.2f} mm around the outside.
- Back-cover trim ends at about {back_end:.2f}% of total width; front-cover trim starts at about {front_start:.2f}%.

CRITICAL TYPOGRAPHY RULE
Generate BACKGROUND ARTWORK ONLY. Do not draw any words, letters, numbers, logos, signatures, pseudo-text,
watermarks, QR codes, barcodes, fake labels, placeholder type, or typographic marks. Exact Korean text will be added later by the application.

LAYOUT REQUIREMENTS
- Keep the spine visually continuous with the overall artwork, but relatively low-detail and calm so vertical or rotated spine text can be placed cleanly.
- Reserve intentional negative space on the front cover for a strong title hierarchy and smaller subtitle/date/company text.
- Reserve a quieter information zone on the back cover for body copy and company/contact information.
- Do not create visible boxes that look like text placeholders; use natural composition and negative space instead.
- Keep important decorative focal points away from the outer bleed edge and away from the spine folds.
- Make the front cover feel strongest, the back cover supportive, and the spine integrated rather than pasted in.
- Use sophisticated editorial design, refined spacing, controlled contrast, professional print sensibility, and contemporary Korean publication aesthetics.
- Avoid cheap flyer aesthetics, generic template looks, clip-art, childish decoration, random icons, overbusy gradients, excessive glow, and stock-photo collage style.
- No crop marks, trim marks, rulers, registration marks, 3D perspective, book shadows, hands, desks, or environmental mockup context.

STYLE DIRECTION
Preset: {req.preset_name or 'custom'}
{req.style_request}

SEMANTIC CONTEXT ONLY — use this to inspire visual language, never render it as text:
{req.theme_context or 'professional report / publication cover'}

Return one polished, coherent background artwork with a clear front/back/spine rhythm and enough clean space for precise typography overlays.
""".strip()


def _public_error_from_http(exc: urllib.error.HTTPError) -> AiCoverImageError:
    detail = ""
    try:
        payload = json.loads(exc.read().decode("utf-8"))
        detail = str((payload.get("error") or {}).get("message") or "")
    except Exception:
        pass
    if exc.code in {401, 403}:
        return AiCoverImageError(
            "OpenAI API 키 또는 이미지 모델 권한을 확인해 주세요.",
            status_code=503,
            code="OPENAI_AUTH_FAILED",
        )
    if exc.code == 429:
        return AiCoverImageError(
            "AI 이미지 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
            status_code=429,
            code="OPENAI_RATE_LIMIT",
        )
    if exc.code == 400:
        return AiCoverImageError(
            f"AI 이미지 생성 입력값을 처리하지 못했습니다.{(' ' + detail[:160]) if detail else ''}",
            status_code=400,
            code="OPENAI_IMAGE_REQUEST_INVALID",
        )
    return AiCoverImageError(
        f"OpenAI 이미지 생성 요청에 실패했습니다.{(' ' + detail[:160]) if detail else ''}",
        status_code=502,
        code="OPENAI_IMAGE_REQUEST_FAILED",
    )


def generate_cover_image(payload: dict[str, Any], *, uid: str) -> dict[str, Any]:
    req = normalize_cover_request(payload)
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise AiCoverImageError(
            "관리자 OpenAI API 키가 아직 서버에 설정되지 않았습니다.",
            status_code=503,
            code="OPENAI_API_KEY_MISSING",
        )

    model = os.environ.get("OPENAI_AI_IMAGE_MODEL", DEFAULT_IMAGE_MODEL).strip() or DEFAULT_IMAGE_MODEL
    quality = os.environ.get("OPENAI_AI_IMAGE_QUALITY", DEFAULT_IMAGE_QUALITY).strip().lower() or DEFAULT_IMAGE_QUALITY
    if quality not in {"low", "medium", "high", "auto"}:
        quality = DEFAULT_IMAGE_QUALITY
    size = choose_image_size(req)
    body = {
        "model": model,
        "prompt": build_cover_prompt(req),
        "n": 1,
        "size": size,
        "quality": quality,
        "background": "opaque",
        "output_format": "png",
        "moderation": "auto",
        "user": hashlib.sha256(uid.encode("utf-8")).hexdigest()[:32],
    }
    request = urllib.request.Request(
        OPENAI_IMAGES_URL,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise _public_error_from_http(exc) from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise AiCoverImageError(
            "AI 이미지 서버 응답을 받지 못했습니다. 다시 시도해 주세요.",
            status_code=502,
            code="OPENAI_IMAGE_UNAVAILABLE",
        ) from exc

    images = data.get("data") if isinstance(data.get("data"), list) else []
    first = images[0] if images and isinstance(images[0], dict) else {}
    image_base64 = str(first.get("b64_json") or "")
    if not image_base64:
        raise AiCoverImageError(
            "AI 이미지 결과를 받지 못했습니다.",
            status_code=502,
            code="OPENAI_IMAGE_EMPTY",
        )

    return {
        "image_base64": image_base64,
        "mime_type": "image/png",
        "model": str(data.get("model") or model),
        "size": str(data.get("size") or size),
        "quality": str(data.get("quality") or quality),
        "prompt_version": "cover-background-v1",
        "geometry": {
            "trim_width_mm": req.trim_width_mm,
            "trim_height_mm": req.trim_height_mm,
            "spine_mm": req.spine_mm,
            "bleed_mm": req.bleed_mm,
            "work_width_mm": req.work_width_mm,
            "work_height_mm": req.work_height_mm,
        },
    }
