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
DEFAULT_IMAGE_QUALITY = "high"
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

    request = CoverImageRequest(
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
            "전체 펼침 표지 비율이 이미지 생성 지원 범위를 벗어났습니다.",
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
    work_width = req.work_width_mm
    spine_share = req.spine_mm / work_width * 100 if work_width else 0
    back_start_mm = req.bleed_mm + req.wing_mm
    back_end_mm = back_start_mm + req.trim_width_mm
    front_start_mm = back_end_mm + req.spine_mm
    front_end_mm = front_start_mm + req.trim_width_mm
    flap_note = (
        f"- Outer flaps: {req.wing_mm:.2f} mm on both far left and far right; keep them visually continuous and low-detail."
        if req.wing_mm > 0
        else "- No outer flaps are included."
    )
    return f"""
Create a premium, production-ready FULL SPREAD PRINT COVER BACKGROUND viewed perfectly flat and straight-on.
This is not a mockup and not a photo of a physical book. It is the actual 2D artwork background for printing.

GEOMETRY
- Total spread including bleed and flaps: {req.work_width_mm:.2f} × {req.work_height_mm:.2f} mm.
- Back cover trim: {req.trim_width_mm:.2f} mm wide, from about {back_start_mm / work_width * 100:.2f}% to {back_end_mm / work_width * 100:.2f}% of total width.
- Center spine: {req.spine_mm:.2f} mm wide, about {spine_share:.2f}% of the full spread.
- Front cover trim: {req.trim_width_mm:.2f} mm wide, from about {front_start_mm / work_width * 100:.2f}% to {front_end_mm / work_width * 100:.2f}% of total width.
{flap_note}
- Bleed: {req.bleed_mm:.2f} mm around the outside.

CRITICAL TYPOGRAPHY RULE
Generate BACKGROUND ARTWORK ONLY. Do not draw any words, letters, numbers, logos, signatures, pseudo-text,
watermarks, QR codes, barcodes, fake labels, placeholder type, or typographic marks. Exact Korean text will be added later by the application.

ART DIRECTION
- Treat this as a contemporary art-directed editorial publication, not a brochure template.
- Use a disciplined editorial grid, generous negative space, refined asymmetry, clear focal hierarchy, controlled scale contrast, and a limited cohesive color system.
- Build sophistication through proportion, rhythm, spacing, geometry, subtle texture, and restrained depth rather than decorative effects.
- The result should feel suitable for a premium annual report, cultural publication, policy report, professional forum booklet, or high-end educational casebook.

LAYOUT REQUIREMENTS
- The exact spine is {req.spine_mm:.2f} mm wide. Do NOT invent a wider or narrower visual spine.
- Do not draw a visible center spine strip, seam, fold, contrasting vertical band, or artificial color break. Let the artwork flow continuously through the exact center spine area; the application will overlay exact spine guides and typography later.
- Keep the exact spine area relatively calm and low-detail so vertical or rotated spine text remains clear.
- Reserve intentional negative space inside the front-cover trim for a strong title hierarchy and smaller subtitle/date/company text.
- Reserve a quieter information zone inside the back-cover trim for body copy and company/contact information.
- If flaps exist, continue the artwork naturally into them without moving the front/back focal areas into the flap zones.
- Do not create visible boxes that look like text placeholders; use natural composition and negative space instead.
- Keep important decorative focal points away from the outer bleed edge, flap folds, and spine folds.
- Make the front cover feel strongest, the back cover supportive, and the spine/flaps integrated rather than pasted in.
- Use sophisticated editorial design, refined spacing, controlled contrast, professional print sensibility, and contemporary Korean publication aesthetics.
- Avoid outdated public brochure aesthetics, generic government handout styling, ribbon waves, glossy corporate swooshes, beveled shapes, lens flares, fake metallic shine, clip-art, childish decoration, random icons, stock-photo collage, pseudo-3D graphics, busy gradients, excessive glow, and generic template looks.
- No crop marks, trim marks, rulers, registration marks, 3D perspective, book shadows, hands, desks, or environmental mockup context.

STYLE DIRECTION
Preset: {req.preset_name or 'custom'}
{req.style_request}

SEMANTIC CONTEXT ONLY — use this to inspire visual language, never render it as text:
{req.theme_context or 'professional report / publication cover'}

QUALITY BAR
- Prefer one strong, coherent visual idea over many decorative elements.
- Keep the palette restrained: usually one base color family plus one or two accents.
- Preserve visual breathing room. Do not fill every area.
- Favor timeless editorial composition over trendy effects that will date quickly.
- The artwork must remain elegant when Korean typography is added later.

Return one polished, coherent background artwork with a clear flap/back/spine/front/flap rhythm where applicable and enough clean space for precise typography overlays.
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
    quality = os.environ.get("OPENAI_AI_IMAGE_QUALITY", DEFAULT_IMAGE_QUALITY).strip().lower() or DEFAULT_IMAGE_QUALITY
    if quality not in _allowed_qualities(model):
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
        "prompt_version": "cover-background-v4-editorial-spine",
        "geometry": {
            "trim_width_mm": req.trim_width_mm,
            "trim_height_mm": req.trim_height_mm,
            "spine_mm": req.spine_mm,
            "wing_mm": req.wing_mm,
            "bleed_mm": req.bleed_mm,
            "work_width_mm": req.work_width_mm,
            "work_height_mm": req.work_height_mm,
        },
    }
