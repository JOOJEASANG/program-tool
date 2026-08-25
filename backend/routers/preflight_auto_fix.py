from __future__ import annotations

import json

from flask import Blueprint, Response, request

from routers.preflight import (
    _delete_storage_path,
    _deliver_pdf_response,
    _error,
    _read_pdf_from_request,
    _read_pdf_from_storage,
    _request_id,
    _safe_pdf_name,
)
from services.preflight_auto_fix import auto_fix_pdf_bytes
from utils.auth import require_auth


preflight_auto_fix_bp = Blueprint("preflight_auto_fix", __name__)


def _params() -> dict:
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        params = payload.get("params") or {}
        return params if isinstance(params, dict) else {}
    raw = request.form.get("params") or "{}"
    try:
        parsed = json.loads(raw)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _run(filename: str, data: bytes):
    params = _params()
    normalize = _bool(params.get("normalize_page_size"))
    pad_mode = str(params.get("pad_mode") or "none").strip().lower()
    if not normalize and pad_mode == "none":
        return _error(
            "자동 수정할 항목을 하나 이상 선택하세요.",
            400,
            "PREFLIGHT_AUTO_FIX_EMPTY",
        )
    try:
        result = auto_fix_pdf_bytes(
            data,
            normalize_page_size=normalize,
            pad_mode=pad_mode,
        )
    except ValueError as exc:
        return _error(str(exc), 400, "PREFLIGHT_AUTO_FIX_INVALID")
    except Exception:
        return _error(
            "인쇄용 자동 수정 중 오류가 발생했습니다.",
            500,
            "PREFLIGHT_AUTO_FIX_INTERNAL",
        )

    note = (
        f"safe-print-fix;normalize={int(result.normalize_page_size)};"
        f"target={result.target_mm};pad={result.pad_mode};"
        f"added_blanks={result.added_blank_pages};vector_text=preserved"
    )
    response = Response(
        result.data,
        status=200,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{_safe_pdf_name(filename, "print_fixed")}"'
            ),
            "X-Auto-Fix-Note": note,
            "X-Auto-Fix-Blank-Count": str(result.added_blank_pages),
            "Access-Control-Expose-Headers": (
                "X-Auto-Fix-Note, X-Auto-Fix-Blank-Count, Content-Disposition, X-Request-ID"
            ),
            "X-Request-ID": _request_id(),
        },
    )
    return response


@preflight_auto_fix_bp.route("/auto-fix", methods=["POST"])
@require_auth
def auto_fix(uid):
    uploaded, data, error = _read_pdf_from_request()
    if error:
        return error
    filename = uploaded.filename or "document.pdf"
    response = _run(filename, data)
    return _deliver_pdf_response(
        uid,
        response,
        filename=_safe_pdf_name(filename, "print_fixed"),
        source="preflight-auto-fix-direct",
    )


@preflight_auto_fix_bp.route("/auto-fix-storage", methods=["POST"])
@require_auth
def auto_fix_storage(uid):
    filename, data, path, error = _read_pdf_from_storage(uid)
    try:
        if error:
            return error
        source_name = filename or "document.pdf"
        response = _run(source_name, data)
        return _deliver_pdf_response(
            uid,
            response,
            filename=_safe_pdf_name(source_name, "print_fixed"),
            source="preflight-auto-fix-storage",
            force_storage=True,
        )
    finally:
        _delete_storage_path(path)
