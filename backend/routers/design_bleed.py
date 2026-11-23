"""User-uploaded print artwork bleed extension (PDF / JPG / PNG / WEBP)."""
from __future__ import annotations

import json
import re
import tempfile
from pathlib import Path

from flask import Blueprint, Response, request

from routers.preflight import _deliver_pdf_response, _error, _request_id, _safe_pdf_name
from services.design_bleed_extension import ALLOWED_EXTENSIONS, extend_print_bleed
from utils.auth import require_auth
from utils.storage import get_bucket

design_bleed_bp = Blueprint("design_bleed", __name__)
MAX_DIRECT = 20 * 1024 * 1024
MAX_STAGED = 100 * 1024 * 1024
SESSION = re.compile(r"^[A-Za-z0-9_-]{8,40}$")
SOURCE_NAME = re.compile(r"^source[.](pdf|jpg|jpeg|png|webp)$")
# Whitelist maps external object names onto internal literal filenames.
SAFE_SOURCE_NAMES = {
    "source.pdf": "source.pdf",
    "source.jpg": "source.jpg",
    "source.jpeg": "source.jpeg",
    "source.png": "source.png",
    "source.webp": "source.webp",
}


def _params() -> dict:
    try:
        data = request.get_json(silent=True) if request.is_json else json.loads(request.form.get("params") or "{}")
    except (ValueError, TypeError):
        data = {}
    if request.is_json:
        data = (data or {}).get("params") or {}
    return data if isinstance(data, dict) else {}


def _optional_mm(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("완성 크기와 도련을 숫자로 입력해 주세요.") from exc


def _run(uid: str, filename: str, source, *, storage_result: bool = False):
    try:
        params = _params()
        result = extend_print_bleed(
            source,
            filename=filename,
            trim_width_mm=_optional_mm(params.get("trim_width_mm")),
            trim_height_mm=_optional_mm(params.get("trim_height_mm")),
            bleed_mm=_optional_mm(params.get("bleed_mm", 3)),
            edge_mode=str(params.get("edge_mode") or "mirror"),
            fit_mode=str(params.get("fit_mode") or "contain"),
        )
    except ValueError as exc:
        return _error(str(exc), 400, "DESIGN_BLEED_INVALID")
    except Exception:
        return _error("도련을 생성하는 중 오류가 발생했습니다.", 500, "DESIGN_BLEED_INTERNAL")

    outfile = _safe_pdf_name(filename, "bleed")
    response = Response(
        result.pdf, mimetype="application/pdf", headers={
            "Content-Disposition": f'attachment; filename="{outfile}"',
            "X-Design-Bleed-Pages": str(result.page_count),
            "X-Design-Bleed-Trim": f"{result.trim_width_mm}x{result.trim_height_mm}mm",
            "X-Design-Bleed-MM": str(result.bleed_mm),
            "Access-Control-Expose-Headers": (
                "X-Design-Bleed-Pages, X-Design-Bleed-Trim, X-Design-Bleed-MM, Content-Disposition"
            ),
            "X-Request-ID": _request_id(),
        },
    )
    return _deliver_pdf_response(
        uid, response, filename=outfile, source="design-bleed-enhancer",
        force_storage=storage_result,
    )


@design_bleed_bp.route("/extend", methods=["POST"])
@require_auth
def extend_direct(uid):
    uploaded = request.files.get("file")
    if uploaded is None:
        return _error("원본 파일을 업로드해 주세요.", 400, "DESIGN_BLEED_FILE_REQUIRED")
    filename = uploaded.filename or "design.pdf"
    if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
        return _error("PDF, JPG, PNG, WEBP만 지원합니다.", 400, "DESIGN_BLEED_FORMAT")
    data = uploaded.read(MAX_DIRECT + 1)
    if len(data) > MAX_DIRECT:
        return _error("20MB보다 큰 파일은 대용량 업로드로 처리해 주세요.", 413, "DESIGN_BLEED_TOO_LARGE")
    if not data:
        return _error("비어 있는 파일입니다.", 400, "DESIGN_BLEED_EMPTY")
    return _run(uid, filename, data)


@design_bleed_bp.route("/extend-storage", methods=["POST"])
@require_auth
def extend_storage(uid):
    data = request.get_json(silent=True) or {}
    storage_path = str(data.get("storage_path") or "")
    prefix = f"preflight_temp/{uid}/"
    parts = storage_path.split("/")
    if (not storage_path.startswith(prefix) or len(parts) != 4 or
            not SESSION.fullmatch(parts[2]) or not SOURCE_NAME.fullmatch(parts[3])):
        return _error("업로드 파일에 접근할 권한이 없습니다.", 403, "DESIGN_BLEED_STORAGE_FORBIDDEN")

    safe_filename = SAFE_SOURCE_NAMES.get(parts[3])
    if safe_filename is None:
        return _error("지원하지 않는 원본 파일입니다.", 400, "DESIGN_BLEED_STORAGE_NAME")
    with tempfile.TemporaryDirectory(prefix="design-bleed-") as root:
        # Use a fixed server-side path; the uploaded name is never a filesystem path.
        source = Path(root) / "source.bin"
        try:
            blob = get_bucket().blob(storage_path)
            blob.reload()
            if not 0 < int(blob.size or 0) <= MAX_STAGED:
                return _error("파일은 100MB 이하만 지원합니다.", 413, "DESIGN_BLEED_TOO_LARGE")
            blob.download_to_filename(str(source))
            if not 0 < source.stat().st_size <= MAX_STAGED:
                return _error("파일은 100MB 이하만 지원합니다.", 413, "DESIGN_BLEED_TOO_LARGE")
            return _run(uid, safe_filename, source.read_bytes(), storage_result=True)
        except Exception:
            return _error("임시 업로드 파일을 처리하지 못했습니다.", 500, "DESIGN_BLEED_STORAGE_ERROR")
        finally:
            try:
                get_bucket().blob(storage_path).delete()
            except Exception:
                pass
