"""Authenticated server routes for print-production PDF corrections."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from flask import Blueprint, Response, request
from routers.preflight import (
    _delete_storage_path,
    _deliver_pdf_response,
    _download_pdf_from_storage,
    _error,
    _read_pdf_from_request,
    _request_id,
    _safe_pdf_name,
)
from services.preflight_auto_fix import auto_fix_pdf_source
from utils.auth import require_auth

preflight_auto_fix_bp = Blueprint("preflight_auto_fix", __name__)


def _params() -> dict:
    if request.is_json:
        body = request.get_json(silent=True) or {}
        params = body.get("params") or {}
        return params if isinstance(params, dict) else {}
    try:
        params = json.loads(request.form.get("params") or "{}")
    except (ValueError, TypeError):
        params = {}
    return params if isinstance(params, dict) else {}


def _bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").lower().strip() in {"true", "1", "on", "yes"}


def _float(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("도련·안전여백 값이 올바르지 않습니다.") from exc


def _run(filename: str, source_input):
    params = _params()
    try:
        result = auto_fix_pdf_source(
            source_input,
            convert_cmyk=_bool(params.get("convert_cmyk")),
            protect_fonts=_bool(params.get("protect_fonts")),
            flatten_transparency=_bool(params.get("flatten_transparency")),
            add_bleed_mm=_float(params.get("add_bleed_mm", 0)),
            safe_margin_mm=_float(params.get("safe_margin_mm", 0)),
            enhance_sharpness=_bool(params.get("enhance_sharpness")),
            render_dpi=params.get("render_dpi", 300),
        )
    except ValueError as exc:
        return _error(str(exc), 400, "PREFLIGHT_PRINT_FIX_INVALID")
    except Exception:
        return _error("인쇄 보정 중 오류가 발생했습니다.", 500, "PREFLIGHT_PRINT_FIX_INTERNAL")

    note = (
        f"print-production-fix;mode={result.color_mode};dpi={result.render_dpi};"
        f"bleed_mm={result.added_bleed_mm};safe_mm={result.safety_margin_mm};"
        f"rasterized=1;pages={result.page_count};"
        "print_proof_required=1"
    )
    return Response(
        result.data,
        status=200,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{_safe_pdf_name(filename, "print_fixed")}"'
            ),
            "X-Auto-Fix-Note": note,
            "X-Auto-Fix-Page-Count": str(result.page_count),
            "Access-Control-Expose-Headers": (
                "X-Auto-Fix-Note, X-Auto-Fix-Page-Count, Content-Disposition, X-Request-ID"
            ),
            "X-Request-ID": _request_id(),
        },
    )


@preflight_auto_fix_bp.route("/auto-fix", methods=["POST"])
@require_auth
def auto_fix(uid):
    uploaded, data, error = _read_pdf_from_request()
    if error:
        return error
    filename = uploaded.filename or "document.pdf"
    response = _run(filename, data)
    return _deliver_pdf_response(
        uid, response, filename=_safe_pdf_name(filename, "print_fixed"),
        source="preflight-print-fix-direct",
    )


@preflight_auto_fix_bp.route("/auto-fix-storage", methods=["POST"])
@require_auth
def auto_fix_storage(uid):
    path = None
    with tempfile.TemporaryDirectory(prefix="preflight-print-fix-") as temp_dir:
        source_path = Path(temp_dir) / "source.pdf"
        filename, path, error = _download_pdf_from_storage(uid, source_path)
        try:
            if error:
                return error
            source_name = filename or "document.pdf"
            response = _run(source_name, source_path)
            return _deliver_pdf_response(
                uid, response, filename=_safe_pdf_name(source_name, "print_fixed"),
                source="preflight-print-fix-storage",
                force_storage=True,
            )
        finally:
            _delete_storage_path(path)
