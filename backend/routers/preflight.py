import io
import logging
import re
import tempfile
from pathlib import Path

import fitz
from flask import Blueprint, Response, jsonify, request

from models.schemas import PreflightReport
from services.preflight_reliability import run_reliable_checks
from services.preflight_repair import fix_pdf_response
from services.preflight_svc import compute_score
from utils.auth import require_auth
from utils.storage import get_bucket, get_request_id
from utils.storage_delivery import upload_pdf_result

preflight_bp = Blueprint("preflight", __name__)
logger = logging.getLogger(__name__)

MAX_DIRECT_PDF_BYTES = 20 * 1024 * 1024
MAX_STORAGE_PDF_BYTES = 200 * 1024 * 1024
MAX_DIRECT_RESPONSE_BYTES = 20 * 1024 * 1024
MAX_COMPRESS_PAGES = 200
MAX_COMPRESS_PIXELS_TOTAL = 180_000_000
PdfSource = bytes | str | Path


def _request_id() -> str:
    return get_request_id()


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
    return get_bucket()


def _max_storage_mb() -> int:
    return MAX_STORAGE_PDF_BYTES // (1024 * 1024)


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
    data = uploaded.read(MAX_DIRECT_PDF_BYTES + 1)
    if len(data) > MAX_DIRECT_PDF_BYTES:
        return None, None, _error(
            "직접 업로드는 20MB까지 지원합니다. 대용량 업로드로 다시 시도해 주세요.",
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


def _download_pdf_from_storage(uid: str, destination: str | Path):
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("storage_path")
    filename = _safe_pdf_name(payload.get("filename"), "source").removesuffix("_source.pdf") + ".pdf"
    error = _validate_storage_path(uid, raw_path)
    if error:
        return None, None, error

    path = str(raw_path)
    target = Path(destination)
    try:
        blob = _bucket().blob(path)
        blob.reload()
        declared_size = int(blob.size or 0)
        if declared_size > MAX_STORAGE_PDF_BYTES:
            return None, path, _error(
                f"파일이 {_max_storage_mb()}MB 제한을 초과합니다.",
                413,
                "PDF_FILE_TOO_LARGE",
            )
        blob.download_to_filename(str(target))
        actual_size = target.stat().st_size
        if actual_size > MAX_STORAGE_PDF_BYTES:
            return None, path, _error(
                f"파일이 {_max_storage_mb()}MB 제한을 초과합니다.",
                413,
                "PDF_FILE_TOO_LARGE",
            )
        if declared_size and actual_size != declared_size:
            logger.warning(
                "Preflight storage size changed path=%s declared=%s actual=%s request_id=%s",
                path,
                declared_size,
                actual_size,
                _request_id(),
            )
        return filename, path, None
    except Exception:
        logger.warning(
            "Preflight storage read failed path=%s request_id=%s",
            path,
            _request_id(),
            exc_info=True,
        )
        return None, path, _error(
            "업로드된 PDF 파일을 찾거나 읽지 못했습니다. 다시 업로드해 주세요.",
            404,
            "STORAGE_FILE_NOT_FOUND",
        )


def _source_size(source_input: PdfSource) -> int:
    if isinstance(source_input, (str, Path)):
        return Path(source_input).stat().st_size
    return len(source_input)


def _open_pdf(source_input: PdfSource) -> fitz.Document:
    try:
        if isinstance(source_input, (str, Path)):
            return fitz.open(str(source_input))
        return fitz.open(stream=source_input, filetype="pdf")
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


def _run_check_response(filename: str, source_input: PdfSource):
    try:
        document = _open_pdf(source_input)
    except ValueError:
        return _error(
            "PDF 파일을 열 수 없습니다. PDF 복구/정상화 도구를 먼저 실행해 보세요.",
            400,
            "PREFLIGHT_PDF_INVALID",
        )

    try:
        try:
            checks = run_reliable_checks(document, _source_size(source_input))
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


def _deliver_pdf_response(
    uid: str,
    response: Response,
    *,
    filename: str,
    source: str,
    force_storage: bool = False,
):
    if response.status_code >= 400 or response.mimetype != "application/pdf":
        return response
    data = response.get_data()
    if not force_storage and len(data) <= MAX_DIRECT_RESPONSE_BYTES:
        return response
    try:
        delivery = upload_pdf_result(
            _bucket(),
            uid,
            filename=filename,
            data=data,
            metadata={"source": source},
        )
        result = jsonify(delivery)
        result.headers["Cache-Control"] = "no-store"
        result.headers["X-Request-ID"] = _request_id()
        return result
    except Exception:
        return _internal_error("Preflight result upload")


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
    path = None
    with tempfile.TemporaryDirectory(prefix="preflight-check-") as temp_dir:
        source_path = Path(temp_dir) / "source.pdf"
        filename, path, error = _download_pdf_from_storage(uid, source_path)
        try:
            if error:
                return error
            return _run_check_response(filename or "document.pdf", source_path)
        finally:
            _delete_storage_path(path)


def _compress_pdf_response(filename: str, source_input: PdfSource):
    try:
        source = _open_pdf(source_input)
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
        if skipped_pages or len(output) != len(source):
            return _error(
                "일부 페이지를 경량화하지 못해 결과 파일을 만들지 않았습니다.",
                422,
                "PDF_COMPRESS_INCOMPLETE",
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
            f"input={_source_size(source_input)};output={len(output_bytes)};"
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
    filename = uploaded.filename or "document.pdf"
    response = fix_pdf_response(filename, data)
    return _deliver_pdf_response(
        uid,
        response,
        filename=_safe_pdf_name(filename, "repaired"),
        source="preflight-fix-direct",
    )


@preflight_bp.route("/fix-storage", methods=["POST"])
@require_auth
def fix_storage(uid):
    path = None
    with tempfile.TemporaryDirectory(prefix="preflight-fix-") as temp_dir:
        source_path = Path(temp_dir) / "source.pdf"
        filename, path, error = _download_pdf_from_storage(uid, source_path)
        try:
            if error:
                return error
            source_name = filename or "document.pdf"
            response = fix_pdf_response(source_name, source_path)
            return _deliver_pdf_response(
                uid,
                response,
                filename=_safe_pdf_name(source_name, "repaired"),
                source="preflight-fix",
                force_storage=True,
            )
        finally:
            _delete_storage_path(path)


@preflight_bp.route("/compress", methods=["POST"])
@require_auth
def compress(uid):
    uploaded, data, error = _read_pdf_from_request()
    if error:
        return error
    filename = uploaded.filename or "document.pdf"
    response = _compress_pdf_response(filename, data)
    return _deliver_pdf_response(
        uid,
        response,
        filename=_safe_pdf_name(filename, "light"),
        source="preflight-compress-direct",
    )


@preflight_bp.route("/compress-storage", methods=["POST"])
@require_auth
def compress_storage(uid):
    path = None
    with tempfile.TemporaryDirectory(prefix="preflight-compress-") as temp_dir:
        source_path = Path(temp_dir) / "source.pdf"
        filename, path, error = _download_pdf_from_storage(uid, source_path)
        try:
            if error:
                return error
            source_name = filename or "document.pdf"
            response = _compress_pdf_response(source_name, source_path)
            return _deliver_pdf_response(
                uid,
                response,
                filename=_safe_pdf_name(source_name, "light"),
                source="preflight-compress",
                force_storage=True,
            )
        finally:
            _delete_storage_path(path)
