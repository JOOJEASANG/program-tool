"""Mask-guided AI outpainting for print bleed; only *outside* artwork is used.

Uses one paid OpenAI Images API edit per page; never paints over PDF text,
vectors or logos inside TrimBox. Missing API keys and provider errors are
explicit, not silently replaced with synthetic/mirror bleed.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import math
import os
import urllib.error
import urllib.request
import uuid

from PIL import Image, ImageOps

from services.ai_cover_image import AiCoverImageError, _public_error_from_http

logger = logging.getLogger(__name__)
EDIT_URL = "https://api.openai.com/v1/images/edits"
MODEL = "gpt-image-2"
AI_MAX_PAGES = 2
# 16px aligned and stable Image API sizes. Each part of the 3mm fringe
# becomes print-grade only by deterministic upscale; no false 300dpi claim.
MAX_SIDE = 1600
MAX_PIXELS = 2_400_000


def _to_bytes(image: Image.Image) -> bytes:
    data = io.BytesIO()
    image.save(data, "PNG", optimize=True)
    return data.getvalue()


def prepared_masked_images(trim_image: Image.Image, bleed_mm: float, trim_width_mm: float,
                           trim_height_mm: float):
    """Build the reference and a transparent border mask at identical dimensions."""
    width_mm = trim_width_mm + 2 * bleed_mm
    height_mm = trim_height_mm + 2 * bleed_mm
    aspect = width_mm / height_mm
    if aspect < 1/3 or aspect > 3:
        raise ValueError("AI 도련은 가로세로 비율이 1:3~3:1인 파일만 지원합니다.")
    width = min(MAX_SIDE, math.sqrt(MAX_PIXELS * aspect))
    height = width / aspect
    if height > MAX_SIDE:
        height = MAX_SIDE
        width = height * aspect
    width = max(512, round(width/16)*16)
    height = max(512, round(height/16)*16)
    if width*height > MAX_PIXELS * 1.03:
        raise ValueError("AI 도련 처리 크기가 허용 범위를 벗어났습니다.")
    bx = max(3, round(width * bleed_mm / width_mm))
    by = max(3, round(height * bleed_mm / height_mm))
    inner = (bx, by, width-bx, height-by)
    # Start with the fast mirrored background. The AI edits only the
    # exterior masked pixels, using the original print image for context.
    original = trim_image.convert("RGB").resize(
        (inner[2]-inner[0], inner[3]-inner[1]), Image.Resampling.LANCZOS
    )
    scene = Image.new("RGB", (width, height), (255, 255, 255))
    scene.paste(original, inner[:2])
    scene.paste(ImageOps.flip(original.crop((0, 0, original.width, by))), (bx, 0))
    scene.paste(ImageOps.flip(original.crop(
        (0, original.height-by, original.width, original.height))), (bx, height-by))
    scene.paste(ImageOps.mirror(original.crop((0, 0, bx, original.height))), (0, by))
    scene.paste(ImageOps.mirror(original.crop(
        (original.width-bx, 0, original.width, original.height))), (width-bx, by))
    for src, xy in (
        ((0, 0, bx, by), (0, 0)),
        ((original.width-bx, 0, original.width, by), (width-bx, 0)),
        ((0, original.height-by, bx, original.height), (0, height-by)),
        ((original.width-bx, original.height-by, original.width, original.height), (width-bx, height-by)),
    ):
        scene.paste(ImageOps.flip(ImageOps.mirror(original.crop(src))), xy)
    mask = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    mask.paste((255, 255, 255, 255), inner)
    return _to_bytes(scene), _to_bytes(mask), (width, height)


def _multipart(parts: list[tuple[str, str | tuple[str, bytes, str]]]):
    boundary = uuid.uuid4().hex
    output = io.BytesIO()
    for name, value in parts:
        output.write(("--"+boundary+"\r\n").encode("ascii"))
        if isinstance(value, tuple):
            filename, payload, mime = value
            output.write(('Content-Disposition: form-data; name="'+name+'"; filename="'+filename+'"\r\n'
                         +'Content-Type: '+mime+'\r\n\r\n').encode('ascii'))
            output.write(payload)
        else:
            output.write(('Content-Disposition: form-data; name="'+name+'"\r\n\r\n').encode('ascii'))
            output.write(value.encode('utf-8'))
        output.write(b'\r\n')
    output.write(("--"+boundary+"--\r\n").encode("ascii"))
    return output.getvalue(), "multipart/form-data; boundary="+boundary


def outpaint_bleed(trim_image: Image.Image, bleed_mm: float, trim_width_mm: float,
                   trim_height_mm: float, *, uid: str, quality: str = "low",
                   direction: str = "") -> Image.Image:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise AiCoverImageError("관리자 OpenAI API 키가 설정되지 않았습니다.",
                               status_code=503, code="OPENAI_API_KEY_MISSING")
    if quality not in {"low", "medium", "high"}:
        raise ValueError("AI 품질은 저비용·표준·고품질 중에서 선택해 주세요.")
    if len(direction) > 200:
        raise ValueError("AI 배경 보완 요청은 200자 이내로 입력해 주세요.")
    image, mask, dimensions = prepared_masked_images(
        trim_image, bleed_mm, trim_width_mm, trim_height_mm
    )
    prompt = (
        "Production print prepress outpainting. Continue the existing exact "
        "background, gradients, textures, flowers, photographs, shadows and "
        "patterns outward into ONLY the thin transparent outer border of the "
        "provided mask. DO NOT change, redraw, crop, translate or invent any "
        "characters, captions, logos, faces or objects in the opaque central "
        "print design. Seamlessly match colors, lighting and repeated patterns "
        "at the original trim boundary. The central artwork is a strict immutable "
        "reference. Do not add text, frames, marks or printing guides. "
        "Ensure all four corners are filled naturally."
    )
    if direction:
        prompt += " Background detail guidance: "+direction
    data, mime = _multipart([
        ("model", MODEL), ("quality", quality), ("size", f"{dimensions[0]}x{dimensions[1]}"),
        ("n", "1"), ("output_format", "png"), ("moderation", "auto"),
        ("safety_identifier", hashlib.sha256(uid.encode()).hexdigest()[:32]),
        ("prompt", prompt),
        ("image[]", ("original-print.png", image, "image/png")),
        ("mask", ("editable-bleed.png", mask, "image/png")),
    ])
    req = urllib.request.Request(EDIT_URL, data=data,
       headers={"Authorization":"Bearer "+key, "Content-Type":mime},method="POST")
    try:
        timeout = min(300,max(60,int(os.environ.get("OPENAI_AI_IMAGE_TIMEOUT_SECONDS","180"))))
        with urllib.request.urlopen(req, timeout=timeout) as response:
            payload = json.loads(response.read(20_000_000).decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise _public_error_from_http(exc) from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.warning("AI bleed edit unavailable: %s", type(exc).__name__)
        raise AiCoverImageError("AI 도련 서버의 응답을 받지 못했습니다.",
                               status_code=504,code="OPENAI_IMAGE_TIMEOUT") from exc
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise AiCoverImageError("AI 도련 응답을 해석하지 못했습니다.",
                               status_code=502,code="OPENAI_IMAGE_UNAVAILABLE") from exc
    record = (payload.get("data") or [{}])[0]
    encoded = record.get("b64_json") if isinstance(record, dict) else None
    if not isinstance(encoded, str) or not encoded:
        raise AiCoverImageError("AI 도련 결과 이미지가 비어 있습니다.",
                               status_code=502,code="OPENAI_IMAGE_EMPTY")
    try:
        raw = base64.b64decode(encoded, validate=True)
        with Image.open(io.BytesIO(raw)) as result:
            result.load()
            if result.width*result.height>6_000_000:
                raise ValueError("AI result pixels exceed supported limit")
            return result.convert("RGB").resize(dimensions,Image.Resampling.LANCZOS)
    except (ValueError, OSError) as exc:
        raise AiCoverImageError("AI 도련 결과 이미지 형식이 잘못되었습니다.",
                               status_code=502,code="OPENAI_IMAGE_UNAVAILABLE") from exc
