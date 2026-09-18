"""AI-generated background artwork for print cover spreads.

The image model creates background artwork only. Exact Korean copy, spine text,
company names, dates and other typography are rendered by the browser so print
output remains accurate and controllable.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations"
DEFAULT_IMAGE_MODEL = "gpt-image-2"
DEFAULT_IMAGE_QUALITY = "medium"
DEFAULT_IMAGE_TIMEOUT_SECONDS = 180
# OpenAI documents outputs above 2560x1440 total pixels as experimental.
# Stay just below that threshold for the production default while preserving the
# exact requested cover aspect ratio. The browser still composites/export at the
# user's exact millimetre geometry and 300dpi.
STABLE_MAX_PIXELS = 3_600_000
STABLE_MAX_EDGE = 2560
MAX_STYLE = 2200
MAX_CONTEXT = 900

logger = logging.getLogger(__name__)


class AiCoverImageError(RuntimeError):
    def __init__(self, message: str, *, status_code: int = 502, code: str = "AI_COVER_IMAGE_FAILED"):
        super().__init__(message)
        self.status_code = status_code
        self.code = code


@dataclass(frozen=True)
class CoverImageRequest:
    cover_mode: str
    quality_mode: str
    trim_width_mm: float
    trim_height_mm: float
    spine_mm: float
    wing_mm: float
    bleed_mm: float
    style_request: str
    theme_context: str
    preset_name: str

    @property
    def work_width_mm(self) -> float:
        if self.cover_mode == "front":
            return self.trim_width_mm + self.bleed_mm * 2
        return self.trim_width_mm * 2 + self.spine_mm + self.wing_mm * 2 + self.bleed_mm * 2

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
    cover_mode = _clean(payload.get("cover_mode"), 20).lower()
    cover_mode = "front" if cover_mode == "front" else "spread"
    quality_mode = _clean(payload.get("quality_mode"), 20).lower()
    quality_mode = "high" if quality_mode == "high" else "standard"
    trim_width = _number(payload.get("trim_width_mm"), minimum=50, maximum=1000, default=210)
    trim_height = _number(payload.get("trim_height_mm"), minimum=50, maximum=1000, default=297)
    spine = _number(payload.get("spine_mm"), minimum=0, maximum=100, default=0)
    wing = _number(payload.get("wing_mm"), minimum=0, maximum=300, default=0)
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

    if cover_mode == "front":
        spine = 0
        wing = 0
    request = CoverImageRequest(
        cover_mode=cover_mode,
        quality_mode=quality_mode,
        trim_width_mm=trim_width,
        trim_height_mm=trim_height,
        spine_mm=spine,
        wing_mm=wing,
        bleed_mm=bleed,
        style_request=style_request,
        theme_context=theme_context,
        preset_name=preset_name,
    )
    ratio = request.work_width_mm / request.work_height_mm
    if ratio < (1 / 3) or ratio > 3:
        raise AiCoverImageError(
            "표지 비율이 이미지 생성 지원 범위를 벗어났습니다.",
            status_code=400,
            code="AI_COVER_RATIO_UNSUPPORTED",
        )
    return request


def _multiple_of_16_floor(value: float, *, minimum: int = 512, maximum: int = STABLE_MAX_EDGE) -> int:
    floored = int(math.floor(float(value) / 16.0) * 16)
    return max(minimum, min(maximum, floored))


def choose_image_size(req: CoverImageRequest) -> str:
    """Choose a stable GPT Image 2 resolution while preserving spread ratio.

    GPT Image 2 supports arbitrary 16px-aligned resolutions, but very large
    outputs are documented as experimental. Production cover generation stays
    below that experimental pixel threshold; exact print dimensions are owned by
    the browser's millimetre/300dpi compositor.
    """
    ratio = req.work_width_mm / req.work_height_mm
    if ratio >= 1:
        height_cap = min(STABLE_MAX_EDGE / ratio, math.sqrt(STABLE_MAX_PIXELS / ratio))
        height = _multiple_of_16_floor(height_cap)
        width = _multiple_of_16_floor(height * ratio)
    else:
        width_cap = min(STABLE_MAX_EDGE * ratio, math.sqrt(STABLE_MAX_PIXELS * ratio))
        width = _multiple_of_16_floor(width_cap)
        height = _multiple_of_16_floor(width / ratio)
    return f"{width}x{height}"


def build_cover_prompt(req: CoverImageRequest) -> str:
    mode_title = "FRONT COVER ONLY" if req.cover_mode == "front" else "FULL SPREAD PRINT COVER"
    geometry = (
        f"- Front cover including bleed: {req.work_width_mm:.2f} × {req.work_height_mm:.2f} mm.\n"
        f"- Trim size: {req.trim_width_mm:.2f} × {req.trim_height_mm:.2f} mm.\n"
        f"- Bleed: {req.bleed_mm:.2f} mm around all outside edges.\n"
        if req.cover_mode == "front"
        else
        f"- Total spread including bleed and flaps: {req.work_width_mm:.2f} × {req.work_height_mm:.2f} mm.\n"
        f"- Back and front trim: {req.trim_width_mm:.2f} × {req.trim_height_mm:.2f} mm each.\n"
        f"- Exact center spine: {req.spine_mm:.2f} mm.\n"
        f"- Outer flaps: {req.wing_mm:.2f} mm each side.\n"
        f"- Bleed: {req.bleed_mm:.2f} mm around the outside.\n"
    )
    mode_rules = (
        "- Compose ONE portrait front cover only. Do not invent a back cover, spine, fold, mockup, second panel, or book perspective.\n"
        "- Keep one clearly usable typography-safe zone inside the trim area.\n"
        if req.cover_mode == "front"
        else
        "- Let artwork flow continuously across back cover, exact spine, and front cover. Do not draw a visible center spine strip, seam, fold, or artificial center band.\n"
        "- If flaps exist, continue artwork naturally through the flap zones while keeping focal content inside the trim areas.\n"
        "- Keep the front cover visually strongest and the back cover supportive rather than duplicating the same composition.\n"
    )
    return f"""
Create premium, production-ready {mode_title} BACKGROUND ARTWORK, perfectly flat and straight-on.
This is actual 2D print artwork, not a mockup and not a photograph of a physical book.

GEOMETRY
{geometry}- The OUTER BLEED BOUNDARY is the exact artwork canvas boundary. Fill the entire canvas edge-to-edge with finished artwork; artwork must reach the canvas edge.

CRITICAL TYPOGRAPHY RULE
Generate BACKGROUND ARTWORK ONLY.
Do not draw readable words, letters, numbers, logos, signatures, QR codes, barcodes, fake labels, placeholder type, pseudo-text or typographic marks.
Exact Korean text will be added later by the application.

ART DIRECTION
- Follow the selected document category and user visual direction instead of forcing every result into the same abstract geometric template.
- Professional visual approaches may include editorial grids, photography, photo-collage, architectural imagery, material texture, editorial illustration, symbolic scenes, iconographic or infographic structures, framing, image crops, layered fields, modular layouts, refined geometry or a coherent hybrid.
- If photography is requested, create sophisticated text-free editorial imagery with no readable signage, brands or labels.
- If illustration is requested, use publication-grade editorial illustration rather than childish cartoon or clip-art.
- If infographic/icon styling is requested, use symbolic visual structures without generating readable labels or text.
- Keep a clear typography-safe zone, but the rest of the page may carry a stronger focal image or richer visual composition where appropriate.
- Use refined medium saturation by default: slightly richer and more confident than pale pastel, with crisp professional contrast and print-friendly tones.
- Pale colors are allowed as supporting tones, but do not make the entire result washed-out, foggy, low-contrast or weak.
- Dark navy, charcoal, deep teal, emerald, cobalt, purple, coral, orange and other stronger accents are allowed when appropriate to the selected category and mood.
- Prefer a professionally art-directed visual hierarchy over repetitive circles, waves, line networks or generic abstract patterns.

LAYOUT RULES
{mode_rules}- Background and decorative artwork may extend through trim into bleed and crop naturally at the outside edge.
- Keep important focal elements away from the application's typography-safe zone.
- Do not draw visible text-placeholder boxes.
- No crop marks, trim marks, rulers, registration marks, 3D book perspective, book shadows, hands, desks, or environmental mockup context.

STRICT AVOID LIST
- Washed-out low-contrast pastel covering the entire composition.
- Repeating the same thin-line, circle, wave or geometric-network formula regardless of document type.
- Dated government-brochure styling, generic blue wave motifs, glossy swooshes, bevels, metallic shine, lens flare or fake 3D.
- Random clip-art, childish decoration, incoherent collage, fake text, visible logos or generic low-end stock-template aesthetics.
- Crowding every area and leaving no useful typography-safe space.

STYLE DIRECTION
Preset: {req.preset_name or 'custom'}
{req.style_request}

SEMANTIC CONTEXT ONLY — use this to inspire imagery, subject matter, visual metaphor and art direction; never render it as text:
{req.theme_context or 'professional publication cover'}

QUALITY BAR
- The result should feel intentionally designed for the selected category: report, administration, public institution, proposal, event, workbook or educational publication.
- Make composition, imagery and visual language meaningfully different across categories and visual modes.
- Prefer one coherent visual concept over unrelated decoration.
- Keep the result contemporary, premium, print-safe and easy to typeset.
- Make it feel professionally art-directed rather than AI-decorated.

Return one finished background artwork with clear hierarchy, confident color and useful text-safe space.
""".strip()

def _read_provider_error(exc: urllib.error.HTTPError) -> tuple[str, str, str]:
    provider_code = ""
    provider_type = ""
    detail = ""
    try:
        payload = json.loads(exc.read().decode("utf-8"))
        error = payload.get("error") if isinstance(payload.get("error"), dict) else {}
        provider_code = str(error.get("code") or "")
        provider_type = str(error.get("type") or "")
        detail = str(error.get("message") or "")
    except Exception:
        pass
    return provider_code, provider_type, detail


def _public_error_from_http(exc: urllib.error.HTTPError) -> AiCoverImageError:
    provider_code, provider_type, detail = _read_provider_error(exc)
    request_id = ""
    try:
        request_id = str(exc.headers.get("x-request-id") or "")
    except Exception:
        pass
    logger.warning(
        "OpenAI cover image request failed status=%s provider_code=%s provider_type=%s request_id=%s detail=%s",
        exc.code,
        provider_code or "-",
        provider_type or "-",
        request_id or "-",
        detail[:500] or "-",
    )
    detail_lower = detail.lower()
    code_lower = provider_code.lower()

    if code_lower == "moderation_blocked":
        return AiCoverImageError(
            "입력한 디자인 요청이 이미지 안전 정책에 의해 처리되지 않았습니다.",
            status_code=400,
            code="OPENAI_IMAGE_MODERATION_BLOCKED",
        )
    if (
        "organization verification" in detail_lower
        or "organisation verification" in detail_lower
        or "verify your organization" in detail_lower
        or code_lower in {"organization_verification_required", "org_verification_required"}
    ):
        return AiCoverImageError(
            "GPT Image 사용을 위해 OpenAI API 조직 인증이 필요합니다.",
            status_code=503,
            code="OPENAI_IMAGE_VERIFICATION_REQUIRED",
        )
    if (
        code_lower in {"model_not_found", "model_not_available", "unsupported_model"}
        or "does not exist" in detail_lower
        or "do not have access to model" in detail_lower
        or "not have access to model" in detail_lower
    ):
        return AiCoverImageError(
            "현재 OpenAI 프로젝트에서 GPT Image 2 모델을 사용할 수 없습니다.",
            status_code=503,
            code="OPENAI_IMAGE_MODEL_UNAVAILABLE",
        )
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
            "AI 이미지 생성 입력값을 처리하지 못했습니다.",
            status_code=400,
            code="OPENAI_IMAGE_REQUEST_INVALID",
        )
    return AiCoverImageError(
        "OpenAI 이미지 생성 요청에 실패했습니다.",
        status_code=502,
        code="OPENAI_IMAGE_REQUEST_FAILED",
    )


def _allowed_qualities(model: str) -> set[str]:
    del model
    return {"low", "medium", "high", "auto"}


def _image_timeout_seconds() -> int:
    return int(_number(
        os.environ.get("OPENAI_AI_IMAGE_TIMEOUT_SECONDS"),
        minimum=60,
        maximum=300,
        default=DEFAULT_IMAGE_TIMEOUT_SECONDS,
    ))


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
    quality = "high" if req.quality_mode == "high" else "medium"
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
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    timeout_seconds = _image_timeout_seconds()
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise _public_error_from_http(exc) from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.warning("OpenAI cover image request timed out/unavailable after %ss: %r", timeout_seconds, exc)
        raise AiCoverImageError(
            "AI 이미지 생성이 지연되거나 서버 응답을 받지 못했습니다. 다시 시도해 주세요.",
            status_code=504,
            code="OPENAI_IMAGE_TIMEOUT",
        ) from exc
    except json.JSONDecodeError as exc:
        logger.warning("OpenAI cover image response was not valid JSON: %r", exc)
        raise AiCoverImageError(
            "AI 이미지 서버 응답을 해석하지 못했습니다. 다시 시도해 주세요.",
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
        "prompt_version": "cover-background-v7-category-visual-diversity",
        "geometry": {
            "cover_mode": req.cover_mode,
            "quality_mode": req.quality_mode,
            "trim_width_mm": req.trim_width_mm,
            "trim_height_mm": req.trim_height_mm,
            "spine_mm": req.spine_mm,
            "wing_mm": req.wing_mm,
            "bleed_mm": req.bleed_mm,
            "work_width_mm": req.work_width_mm,
            "work_height_mm": req.work_height_mm,
        },
    }
