from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from services.ai_print_design import OpenAIServiceError, generate_background, generate_layout


ai_print_design_bp = Blueprint("ai_print_design", __name__)


class DesignFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(default="", max_length=180)
    subtitle: str = Field(default="", max_length=260)
    body: str = Field(default="", max_length=1400)
    date: str = Field(default="", max_length=160)
    place: str = Field(default="", max_length=220)
    target: str = Field(default="", max_length=220)
    host: str = Field(default="", max_length=220)
    organizer: str = Field(default="", max_length=220)
    operator: str = Field(default="", max_length=220)
    contact: str = Field(default="", max_length=220)
    logo: str = Field(default="", max_length=80)
    spine_title: str = Field(default="", max_length=180)

    @field_validator("*")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()


class LayoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_type: str = Field(pattern="^(cover|poster)$")
    width_mm: float = Field(ge=50, le=1000)
    height_mm: float = Field(ge=50, le=1000)
    spine_mm: float = Field(default=0, ge=0, le=100)
    bleed_mm: float = Field(default=3, ge=0, le=20)
    safe_mm: float = Field(default=10, ge=2, le=50)
    style_prompt: str = Field(default="", max_length=900)
    fields: DesignFields

    @field_validator("style_prompt")
    @classmethod
    def trim_style(cls, value: str) -> str:
        return value.strip()


class BackgroundRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_type: str = Field(pattern="^(cover|poster)$")
    width_mm: float = Field(ge=50, le=1000)
    height_mm: float = Field(ge=50, le=1000)
    spine_mm: float = Field(default=0, ge=0, le=100)
    bleed_mm: float = Field(default=3, ge=0, le=20)
    style_prompt: str = Field(default="", max_length=900)
    background_prompt: str = Field(default="", max_length=2400)
    quality: str = Field(default="high", pattern="^(medium|high)$")

    @field_validator("style_prompt", "background_prompt")
    @classmethod
    def trim_prompt(cls, value: str) -> str:
        return value.strip()


def _validation_error(error: ValidationError):
    first = error.errors()[0] if error.errors() else {}
    field = ".".join(str(item) for item in first.get("loc", []))
    message = first.get("msg") or "입력값을 확인해 주세요."
    detail = f"{field}: {message}" if field else message
    return jsonify({"detail": detail, "code": "INVALID_AI_DESIGN_INPUT"}), 400


def _service_error(error: OpenAIServiceError):
    return jsonify({"detail": str(error), "code": "AI_DESIGN_UPSTREAM_ERROR"}), error.status_code


@ai_print_design_bp.post("/ai-design/layout")
def create_layout():
    try:
        payload = LayoutRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        return _validation_error(error)

    try:
        result = generate_layout(payload.model_dump(), uid=getattr(g, "uid", ""))
    except OpenAIServiceError as error:
        return _service_error(error)
    return jsonify(result)


@ai_print_design_bp.post("/ai-design/background")
def create_background():
    try:
        payload = BackgroundRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        return _validation_error(error)

    try:
        result = generate_background(payload.model_dump(), uid=getattr(g, "uid", ""))
    except OpenAIServiceError as error:
        return _service_error(error)
    return jsonify(result)
