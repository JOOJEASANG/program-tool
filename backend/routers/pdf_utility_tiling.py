from __future__ import annotations

import json

from flask import Blueprint, request

from routers.pdf_utility import (
    _delete_storage_paths,
    _deliver_pdf,
    _download_storage_pdf,
    _error,
    _safe_name,
    _validate_storage_path,
)
from services.pdf_tiling import tile_pdf_bytes
from utils.auth import require_auth


pdf_utility_tiling_bp = Blueprint("pdf_utility_tiling", __name__)
MAX_DIRECT_BYTES = 20 * 1024 * 1024


def _params() -> dict:
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        raw = payload.get("params") or {}
        return raw if isinstance(raw, dict) else {}
    raw = request.form.get("params") or "{}"
    try:
        value = json.loads(raw)
    except Exception:
        return {}
    return value if isinstance(value, dict) else {}


def _float(value, default: float) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _run_with_uid(uid: str, filename: str, data: bytes):
    params = _params()
    try:
        result = tile_pdf_bytes(
            data,
            paper_size=str(params.get("paper_size") or "A3"),
            orientation=str(params.get("orientation") or "auto"),
            printer_margin_mm=_float(params.get("printer_margin_mm"), 3.0),
            overlap_mm=_float(params.get("overlap_mm"), 0.0),
            add_sheet_labels=_bool(params.get("add_sheet_labels")),
        )
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_TILING_INVALID")
    except Exception:
        return _error("대형 분할 출력 PDF 생성 중 오류가 발생했습니다.", 500, "PDF_TILING_INTERNAL")

    base = _safe_name(filename, "large_output").rsplit(".", 1)[0]
    response = _deliver_pdf(uid, result.data, f"{base}_분할출력.pdf", "pdf-utility-tiling")
    response.headers["X-Tile-Source-Pages"] = str(result.source_pages)
    response.headers["X-Tile-Sheet-Count"] = str(result.sheet_count)
    response.headers["X-Tile-Printer-Margin"] = str(result.printer_margin_mm)
    response.headers["X-Tile-Overlap"] = str(result.overlap_mm)
    response.headers["Access-Control-Expose-Headers"] = (
        "X-Tile-Source-Pages, X-Tile-Sheet-Count, X-Tile-Printer-Margin, X-Tile-Overlap, Content-Disposition, X-Request-ID"
    )
    return response


@pdf_utility_tiling_bp.route("/tile", methods=["POST"])
@require_auth
def tile(uid):
    uploaded = request.files.get("file")
    if not uploaded:
        return _error("PDF 파일이 없습니다.", 400, "PDF_TILING_FILE_REQUIRED")
    if not (uploaded.filename or "").lower().endswith(".pdf"):
        return _error("분할 출력 엔진에는 PDF 파일만 전달할 수 있습니다.", 400, "PDF_TILING_FILE_TYPE")
    data = uploaded.read(MAX_DIRECT_BYTES + 1)
    if len(data) > MAX_DIRECT_BYTES:
        return _error("20MB 초과 PDF는 대용량 처리 방식으로 다시 시도하세요.", 413, "PDF_TILING_DIRECT_LIMIT")
    return _run_with_uid(uid, uploaded.filename or "large_output.pdf", data)


@pdf_utility_tiling_bp.route("/tile-storage", methods=["POST"])
@require_auth
def tile_storage(uid):
    payload = request.get_json(silent=True) or {}
    path = str(payload.get("storage_path") or "")
    filename = str(payload.get("filename") or "large_output.pdf")
    try:
        valid_path = _validate_storage_path(uid, path)
        data = _download_storage_pdf(uid, valid_path)
        return _run_with_uid(uid, filename, data)
    except PermissionError as exc:
        return _error(str(exc), 403, "PDF_TILING_STORAGE_FORBIDDEN")
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_TILING_STORAGE_INVALID")
    finally:
        if path:
            _delete_storage_paths([path])
