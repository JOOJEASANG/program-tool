import io
import logging
import os
import re
import uuid

import firebase_admin.storage as fa_storage
import fitz
from flask import Blueprint, Response, jsonify, request

from models.schemas import PreflightReport
from services.preflight_reliability import run_reliable_checks
from services.preflight_repair import fix_pdf_response
from services.preflight_svc import compute_score
from utils.auth import require_auth

preflight_bp = Blueprint("preflight", __name__)
logger = logging.getLogger(__name__)

MAX_PDF_BYTES = 200 * 1024 * 1024
MAX_COMPRESS_PAGES = 200
MAX_COMPRESS_PIXELS_TOTAL = 180_000_000
DEFAULT_STORAGE_BUCKET = os.environ.get(
    "FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app"
)


def _request_id() -> str:
    supplied = (request.headers.get("X-Request-ID") or "").strip()
    if re.fullmatch(r"[A-Za-z0-9._-]{8,64}", supplied):
        return supplied
    return uuid.uuid4().hex[:16]


def _error(detail: str, status: int, code: str):
    request_id = _request_id()
    response = jsonify(
        {"detail": detail, "code": code, "request_id": request_id}
    )
    response.status_code = status
    response.headers["X-Request-ID"] = request_id
    return response


def _internal_error(operation: str):
    request_id = _request_id()
    logger.exception("%s failed request_id=%s", operation, request_id)
    return _error(
        "PDF 처리 중 오류가 발생했습니다.",
        500,
        "PREFLIGHT_INTERNAL_ERROR",
    )


def _bucket():
    return fa_storage.bucket(DEFAULT_STORAGE_BUCKET)


def _delete_storage_path(path: str | None) -> None:
    if not path:
        return
    try:
        _bucket().blob(path).delete()
    except Exception:
        logger.warning(
            "Preflight temp cleanup failed path=%s request_id=%s",
            path,
            _request_id(),
            exc_info=True,
        )


def _read_pdf_from_request():
    uploaded = request.files.get("file")
    if not uploaded:
        return None, None, _error("파일이 없습니다.", 400, "PDF_FILE_REQUIRED")
    if not (uploaded.filename or "").lower().endswith(".pdf"):
        return None, None, _error(
            "PDF 파일만 업로드 가능합니다.",
            400,
            "PDF_FILE_TYPE_INVALID",
        )
    data = uploaded.read(MAX_PDF_BYTES + 1)
    if len(data) > MAX_PDF_BYTES:
        return None, None, _error(
            "파일이 200MB 제한을 초과합니다.",
            413,
            "PDF_FILE_TOO_LARGE",
        )
    return uploaded, data, None


def _validate_storage_path(uid: str, path: str | None):
    if not path or not isinstance(path, str):
        return _error("Storage 파일 경로가 없습니다.", 400, "STORAGE_PATH_REQUIRED")
    if ".." in path or path.startswith("/"):
        return _error("잘못된 Storage 파일 경로입니다.", 400, "STORAGE_PATH_INVALID")
    if not path.startswith(f"preflight_temp/{uid}/"):
        return _error("이 파일에 접근할 권한이 없습니다.", 403, "STORAGE_PATH_FORBIDDEN")
    if not path.lower().endswith(".pdf"):
        return _error("PDF 파일만 처리할 수 있습니다.", 400, "STORAGE_FILE_TYPE_INVALID")
    return None


def _safe_pdf_name(filename: str | None, suffix: str) -> str:
    base = (filename or "document.pdf").rsplit(".", 1)[0]
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._-")[:80]
    return f"{base or 'document'}_{suffix}.pdf"


def _read_pdf_from_storage(uid: str):
    payload = request.get_json(silent=True) or {}
    path = payload.get("storage_path")
    filename = _safe_pdf_name(payload.get("filename"), "source").removesuffix("_source.pdf") + ".pdf"
    error = _validate_storage_path(uid, path)
    if error:
        return None, None, None, error
    try:
        blob = _bucket().blob(path)
        blob.reload()
        size = int(blob.size or 0)
        if size > MAX_PDF_BYTES:
            return None, None, path, _error(
                "파일이 200MB 제한을 초과합니다.",
                413,
                "PDF_FILE_TOO_LARGE",
            )
        data = blob.download_as_bytes()
        if len(data) > MAX_PDF_BYTES:
            return None, None, path, _error(
                "파일이 200MB 제한을 초과합니다.",
                413,
                "PDF_FILE_TOO_LARGE",
            )
        return filename, data, path, None
    except Exception:
        logger.warning(
            "Preflight storage read failed path=%s request_id=%s",
            path,
            _request_id(),
            exc_info=True,
        )
        return None, None, path, _error(
            "업로드된 PDF 파일을 찾거나 읽지 못했습니다. 다시 업로드해 주세요.",
            404,
            "STORAGE_FILE_NOT_FOUND",
        )


def _open_pdf(data: bytes) -> fitz.Document:
    try:
        return fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ValueError("PDF 파일을 열 수 없습니다.") from exc


def _json_params() -> dict:
    payload = request.get_json(silent=True) or {}
    params = payload.get("params") or {}
    return params if isinstance(params, dict) else {}


def _compress_options() -> tuple[int, int, str]:
    params = _json_params()
    quality = (
        request.form.get("quality")
        or params.get("quality")
        or "balanced"
    ).strip().lower()
    presets = {
        "small": (120, 62, "small"),
        "balanced": (150, 72, "balanced"),
        "clear": (180, 82, "clear"),
    }
    return presets.get(quality, presets["balanced"])


def _run_check_response(filename: str, data: bytes):
    try:
        document = _open_pdf(data)
    except ValueError:
        return _error(
            "PDF 파일을 열 수 없습니다. PDF 복구/정상화 도구를 먼저 실행해 보세요.",
            400,
            "PREFLIGHT_PDF_INVALID",
        )

    try:
        try:
            checks = run_reliable_checks(document, len(data))
            score = compute_score(checks)
            report = PreflightReport(
                filename=filename or "document.pdf",
                page_count=len(document),
                checks=checks,
                ai_feedback=None,
                score=score,
            )
            response = jsonify(report.model_dump())
            response.headers["X-Request-ID"] = _request_id()
            return response
        except Exception:
            return _internal_error("Preflight check")
    finally:
        document.close()


@preflight_bp.route("/check", methods=["POST"])
@require_auth
def check(uid):
    uploaded, data, error = _read_pdf_from_request()
    if error:
        return error
    return _run_check_response(uploaded.filename or "document.pdf", data)


@preflight_bp.route("/check-storage", methods=["POST"])
@require_auth
def check_storage(uid):
    filename, data, path, error = _read_pdf_from_storage(uid)
    try:
        if error:
            return error
        return _run_check_response(filename or "document.pdf", data)
    finally:
        _delete_storage_path(path)


def _compress_pdf_response(filename: str, data: bytes):
    try:
        source = _open_pdf(data)
    except ValueError:
        return _error(
            "PDF 파일을 열 수 없어 경량화를 진행할 수 없습니다. 먼저 PDF 복구/정상화를 실행해 보세요.",
            400,
            "PREFLIGHT_PDF_INVALID",
        )

    output = fitz.open()
    dpi, jpeg_quality, quality = _compress_options()
    skipped_pages: list[int] = []
    try:
        if len(source) == 0:
            return _error("페이지가 없습니다.", 400, "PDF_PAGE_EMPTY")
        if len(source) > MAX_COMPRESS_PAGES:
            return _error(
                f"경량화는 최대 {MAX_COMPRESS_PAGES}페이지까지 처리할 수 있습니다.",
                413,
                "COMPRESS_PAGE_LIMIT",
            )
        if source.is_encrypted:
            return _error(
                "암호화된 PDF는 먼저 암호를 해제하세요.",
                400,
                "PDF_ENCRYPTED",
            )

        projected_pixels = 0
        for page in source:
            projected_pixels += int(
                page.rect.width * dpi / 72 * page.rect.height * dpi / 72
            )
            if projected_pixels > MAX_COMPRESS_PIXELS_TOTAL:
                return _error(
                    "PDF 해상도와 페이지 수가 경량화 처리 한도를 초과합니다.",
                    413,
                    "COMPRESS_PIXEL_LIMIT",
                )

        matrix = fitz.Matrix(dpi / 72.0, dpi / 72.0)
        for index in range(len(source)):
            try:
                page = source[index]
                rect = page.rect
                if rect.width <= 0 or rect.height <= 0:
                    raise ValueError("invalid page size")
                pixmap = page.get_pixmap(
                    matrix=matrix,
                    alpha=False,
                    annots=True,
                )
                jpeg = pixmap.tobytes(
                    "jpeg",
                    jpg_quality=jpeg_quality,
                )
                new_page = output.new_page(
                    width=rect.width,
                    height=rect.height,
                )
                new_page.insert_image(new_page.rect, stream=jpeg)
            except Exception:
                skipped_pages.append(index + 1)

        if len(output) == 0:
            return _error(
                "경량화 가능한 페이지가 없습니다.",
                400,
                "COMPRESS_OUTPUT_EMPTY",
            )

        buffer = io.BytesIO()
        output.save(
            buffer,
            garbage=4,
            deflate=True,
            deflate_images=True,
            clean=True,
        )
        output_bytes = buffer.getvalue()
        output_name = _safe_pdf_name(filename, f"light_{quality}")
        note = (
            f"rasterized-jpeg;quality={quality};dpi={dpi};jpg={jpeg_quality};"
            f"input={len(data)};output={len(output_bytes)};"
            f"skipped={','.join(map(str, skipped_pages))}"
        )
        response = Response(
            output_bytes,
            status=200,
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{output_name}"',
                "X-Compress-Note": note,
                "Access-Control-Expose-Headers": (
                    "X-Compress-Note, Content-Disposition, X-Request-ID"
                ),
                "X-Request-ID": _request_id(),
            },
        )
        return response
    except Exception:
        return _internal_error("Preflight compress")
    finally:
        source.close()
        output.close()


@preflight_bp.route("/fix", methods=["POST"])
@require_auth
def fix(uid):
    uploaded, data, error = _read_pdf_from_request()
    if error:
        return error
    return fix_pdf_response(uploaded.filename or "document.pdf", data)


@preflight_bp.route("/fix-storage", methods=["POST"])
@require_auth
def fix_storage(uid):
    filename, data, path, error = _read_pdf_from_storage(uid)
    try:
        if error:
            return error
        return fix_pdf_response(filename or "document.pdf", data)
    finally:
        _delete_storage_path(path)


@preflight_bp.route("/compress", methods=["POST"])
@require_auth
def compress(uid):
    uploaded, data, error = _read_pdf_from_request()
    if error:
        return error
    return _compress_pdf_response(uploaded.filename or "document.pdf", data)


@preflight_bp.route("/compress-storage", methods=["POST"])
@require_auth
def compress_storage(uid):
    filename, data, path, error = _read_pdf_from_storage(uid)
    try:
        if error:
            return error
        return _compress_pdf_response(filename or "document.pdf", data)
    finally:
        _delete_storage_path(path)
