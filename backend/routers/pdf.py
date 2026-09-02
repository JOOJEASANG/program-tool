import json
import logging
import shutil
import tempfile
from pathlib import Path

import fitz
from flask import (
    Blueprint,
    Response,
    jsonify,
    request,
)

from models.schemas import PdfProcessRequest
from services.pdf_engine import process_pdf_bytes, process_pdf_paths
from utils.auth import require_auth
from utils.storage import get_bucket, get_request_id
from utils.storage_delivery import upload_pdf_result

pdf_bp = Blueprint("pdf", __name__)
logger = logging.getLogger(__name__)

MAX_PDF_FILE_BYTES = 200 * 1024 * 1024
MAX_DIRECT_TOTAL_PDF_BYTES = 20 * 1024 * 1024
MAX_DIRECT_RESPONSE_BYTES = 20 * 1024 * 1024
MAX_TOTAL_PDF_BYTES = 300 * 1024 * 1024
MAX_PDF_FILES = 50
MAX_REQUEST_PAGES = 2000


def _bucket():
    return get_bucket()


def _request_id() -> str:
    return get_request_id()


def _error_response(detail: str, status: int, code: str):
    request_id = _request_id()
    response = jsonify({
        "detail": detail,
        "code": code,
        "request_id": request_id,
    })
    response.status_code = status
    response.headers["X-Request-ID"] = request_id
    return response


def _attach_request_id(response):
    response.headers["X-Request-ID"] = _request_id()
    return response


def _max_file_mb() -> int:
    return MAX_PDF_FILE_BYTES // (1024 * 1024)


def _max_direct_total_mb() -> int:
    return MAX_DIRECT_TOTAL_PDF_BYTES // (1024 * 1024)


def _max_total_mb() -> int:
    return MAX_TOTAL_PDF_BYTES // (1024 * 1024)


def _cleanup_storage_paths(bucket, storage_paths: list[str]) -> None:
    if bucket is None:
        return
    for path in storage_paths:
        try:
            bucket.blob(path).delete()
        except Exception:
            logger.warning(
                "Temporary PDF cleanup failed path=%s request_id=%s",
                path,
                _request_id(),
                exc_info=True,
            )


def _cleanup_local_directory(path: str | Path) -> None:
    try:
        shutil.rmtree(path, ignore_errors=False)
    except FileNotFoundError:
        pass
    except Exception:
        logger.warning(
            "Local PDF temp cleanup failed path=%s request_id=%s",
            path,
            _request_id(),
            exc_info=True,
        )


def _validate_request_shape(req: PdfProcessRequest, file_count: int) -> None:
    if file_count <= 0:
        raise ValueError("파일이 없습니다")
    if file_count > MAX_PDF_FILES:
        raise ValueError(f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다")
    if not req.pages:
        raise ValueError("출력할 페이지가 없습니다")
    if len(req.pages) > MAX_REQUEST_PAGES:
        raise ValueError(f"페이지는 최대 {MAX_REQUEST_PAGES}개까지 처리할 수 있습니다")


def _validate_page_references(req: PdfProcessRequest, docs: list[fitz.Document]) -> None:
    for page in req.pages:
        if page.excluded or page.page_type in ("divider", "blank"):
            continue
        if page.file_index < 0 or page.file_index >= len(docs):
            raise ValueError("페이지 정보의 파일 번호가 올바르지 않습니다")
        if page.page_index < 0 or page.page_index >= len(docs[page.file_index]):
            raise ValueError("페이지 정보의 페이지 번호가 올바르지 않습니다")


def _validate_pdf_request(req: PdfProcessRequest, file_bytes_list: list[bytes]) -> None:
    _validate_request_shape(req, len(file_bytes_list))
    docs: list[fitz.Document] = []
    total_bytes = 0
    try:
        for data in file_bytes_list:
            if len(data) > MAX_PDF_FILE_BYTES:
                raise ValueError(f"파일이 {_max_file_mb()} MB를 초과합니다")
            total_bytes += len(data)
            if total_bytes > MAX_TOTAL_PDF_BYTES:
                raise ValueError(
                    f"전체 파일 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다"
                )
            try:
                docs.append(fitz.open(stream=data, filetype="pdf"))
            except Exception as exc:
                raise ValueError("유효한 PDF 파일이 아닙니다") from exc
        _validate_page_references(req, docs)
    finally:
        for doc in docs:
            doc.close()


def _invalid_pdf_names(file_bytes_list: list[bytes], filenames: list[str]) -> list[str]:
    """Return every corrupt/unsupported PDF name without stopping at the first file."""
    invalid: list[str] = []
    for index, data in enumerate(file_bytes_list):
        document = None
        try:
            document = fitz.open(stream=data, filetype="pdf")
            if document.page_count < 1:
                invalid.append(filenames[index])
        except Exception:
            invalid.append(filenames[index])
        finally:
            if document is not None:
                document.close()
    return invalid


def _format_upload_issues(
    invalid_types: list[str],
    too_large: list[str],
    invalid_pdfs: list[str],
) -> str:
    parts: list[str] = []
    if invalid_types:
        parts.append("PDF 형식이 아닌 파일: " + ", ".join(invalid_types))
    if too_large:
        parts.append(
            f"{_max_file_mb()} MB 초과 파일: " + ", ".join(too_large)
        )
    if invalid_pdfs:
        parts.append("유효하지 않은 PDF: " + ", ".join(invalid_pdfs))
    return "업로드 파일 검증 실패 — " + " / ".join(parts)


def _validate_pdf_paths(req: PdfProcessRequest, file_paths: list[str | Path]) -> None:
    _validate_request_shape(req, len(file_paths))
    docs: list[fitz.Document] = []
    total_bytes = 0
    try:
        for path in file_paths:
            size = Path(path).stat().st_size
            if size > MAX_PDF_FILE_BYTES:
                raise ValueError(f"파일이 {_max_file_mb()} MB를 초과합니다")
            total_bytes += size
            if total_bytes > MAX_TOTAL_PDF_BYTES:
                raise ValueError(
                    f"전체 파일 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다"
                )
            try:
                docs.append(fitz.open(str(path)))
            except Exception as exc:
                raise ValueError("유효한 PDF 파일이 아닙니다") from exc
        _validate_page_references(req, docs)
    finally:
        for doc in docs:
            doc.close()


def _validate_storage_path(uid: str, path: str) -> None:
    if not isinstance(path, str) or not path:
        raise ValueError("잘못된 파일 경로입니다")
    if "\x00" in path or ".." in path or path.startswith("/"):
        raise PermissionError("허용되지 않은 파일 경로입니다")
    if not path.startswith(f"pdf_temp/{uid}/"):
        raise PermissionError("허용되지 않은 파일 경로입니다")
    if not path.lower().endswith(".pdf"):
        raise ValueError("PDF 파일만 처리할 수 있습니다")


def _internal_error_response(message: str):
    request_id = _request_id()
    logger.exception("%s request_id=%s", message, request_id)
    return _error_response(
        "PDF 처리 중 오류가 발생했습니다.",
        500,
        "PDF_INTERNAL_ERROR",
    )


@pdf_bp.route("/process", methods=["POST"])
@require_auth
def process(uid):
    try:
        req = PdfProcessRequest.model_validate(
            json.loads(request.form.get("settings", "{}"))
        )
    except Exception:
        return _error_response("PDF 처리 설정이 올바르지 않습니다.", 422, "PDF_INVALID_SETTINGS")

    files = request.files.getlist("files")
    if not files:
        return _error_response("PDF 파일이 없습니다.", 400, "PDF_FILES_REQUIRED")
    if len(files) > MAX_PDF_FILES:
        return _error_response(
            f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다",
            400,
            "PDF_TOO_MANY_FILES",
        )

    file_bytes_list: list[bytes] = []
    filenames: list[str] = []
    invalid_types: list[str] = []
    too_large: list[str] = []
    total_bytes = 0
    for index, uploaded in enumerate(files):
        filename = uploaded.filename or f"파일 {index + 1}"
        if not filename.lower().endswith(".pdf"):
            invalid_types.append(filename)
            continue
        data = uploaded.read(MAX_PDF_FILE_BYTES + 1)
        if len(data) > MAX_PDF_FILE_BYTES:
            too_large.append(filename)
            continue
        total_bytes += len(data)
        file_bytes_list.append(data)
        filenames.append(filename)

    invalid_pdfs = _invalid_pdf_names(file_bytes_list, filenames)
    if invalid_types or too_large or invalid_pdfs:
        detail = _format_upload_issues(invalid_types, too_large, invalid_pdfs)
        if too_large:
            return _error_response(detail, 413, "PDF_FILE_TOO_LARGE")
        if invalid_types:
            return _error_response(detail, 400, "PDF_INVALID_FILE_TYPE")
        return _error_response(detail, 400, "PDF_VALIDATION_FAILED")

    if total_bytes > MAX_DIRECT_TOTAL_PDF_BYTES:
        return _error_response(
            f"직접 업로드 전체 용량은 최대 {_max_direct_total_mb()} MB까지 처리할 수 있습니다",
            413,
            "PDF_TOTAL_TOO_LARGE",
        )

    try:
        _validate_pdf_request(req, file_bytes_list)
        output_bytes = process_pdf_bytes(file_bytes_list, req)
    except ValueError as exc:
        return _error_response(str(exc), 400, "PDF_VALIDATION_FAILED")
    except Exception:
        return _internal_error_response("Direct PDF processing failed")

    if len(output_bytes) > MAX_DIRECT_RESPONSE_BYTES:
        try:
            delivery = upload_pdf_result(
                _bucket(),
                uid,
                filename="output.pdf",
                data=output_bytes,
                metadata={"source": "pdf-process-direct"},
            )
            response = jsonify(delivery)
            response.headers["Cache-Control"] = "no-store"
            return _attach_request_id(response)
        except Exception:
            return _internal_error_response("Direct PDF result upload failed")

    return _attach_request_id(
        Response(
            output_bytes,
            status=200,
            mimetype="application/pdf",
            headers={"Content-Disposition": "attachment; filename=output.pdf"},
        )
    )


@pdf_bp.route("/process-storage", methods=["POST"])
@require_auth
def process_storage(uid):
    try:
        body = request.get_json(force=True) or {}
        storage_paths = body.get("storage_paths", [])
        req = PdfProcessRequest.model_validate(body.get("settings", {}))
    except Exception:
        return _error_response("PDF 처리 요청이 올바르지 않습니다.", 422, "PDF_INVALID_REQUEST")

    if not isinstance(storage_paths, list):
        return _error_response(
            "storage_paths 형식이 올바르지 않습니다",
            400,
            "PDF_INVALID_STORAGE_PATHS",
        )
    if not storage_paths:
        return _error_response("PDF 파일이 없습니다.", 400, "PDF_FILES_REQUIRED")
    if len(storage_paths) > MAX_PDF_FILES:
        return _error_response(
            f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다",
            400,
            "PDF_TOO_MANY_FILES",
        )
    if len(storage_paths) != len(set(storage_paths)):
        return _error_response(
            "중복된 파일 경로가 있습니다",
            400,
            "PDF_DUPLICATE_STORAGE_PATH",
        )

    try:
        for path in storage_paths:
            _validate_storage_path(uid, path)
    except PermissionError as exc:
        return _error_response(str(exc), 403, "PDF_STORAGE_PATH_FORBIDDEN")
    except ValueError as exc:
        return _error_response(str(exc), 400, "PDF_INVALID_STORAGE_PATH")

    bucket = None
    temp_dir = tempfile.mkdtemp(prefix="pdf-job-")
    output_path = Path(temp_dir) / "output.pdf"
    try:
        bucket = _bucket()
        blobs = []
        declared_total = 0
        for path in storage_paths:
            blob = bucket.blob(path)
            try:
                blob.reload()
            except Exception:
                return _error_response(
                    "업로드된 임시 파일을 찾을 수 없습니다. 다시 저장을 눌러주세요.",
                    404,
                    "PDF_STORAGE_FILE_NOT_FOUND",
                )
            size = int(blob.size or 0)
            if size > MAX_PDF_FILE_BYTES:
                return _error_response(
                    f"파일이 {_max_file_mb()} MB를 초과합니다",
                    413,
                    "PDF_FILE_TOO_LARGE",
                )
            declared_total += size
            if declared_total > MAX_TOTAL_PDF_BYTES:
                return _error_response(
                    f"전체 파일 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다",
                    413,
                    "PDF_TOTAL_TOO_LARGE",
                )
            blobs.append(blob)

        source_paths: list[Path] = []
        actual_total = 0
        for index, blob in enumerate(blobs):
            local_path = Path(temp_dir) / f"source-{index:03d}.pdf"
            blob.download_to_filename(str(local_path))
            size = local_path.stat().st_size
            if size > MAX_PDF_FILE_BYTES:
                return _error_response(
                    f"파일이 {_max_file_mb()} MB를 초과합니다",
                    413,
                    "PDF_FILE_TOO_LARGE",
                )
            actual_total += size
            if actual_total > MAX_TOTAL_PDF_BYTES:
                return _error_response(
                    f"전체 파일 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다",
                    413,
                    "PDF_TOTAL_TOO_LARGE",
                )
            source_paths.append(local_path)

        _validate_pdf_paths(req, source_paths)
        process_pdf_paths(source_paths, req, output_path)
        delivery = upload_pdf_result(
            bucket,
            uid,
            filename="output.pdf",
            source_path=output_path,
            metadata={"source": "pdf-process"},
        )
        response = jsonify(delivery)
        response.headers["Cache-Control"] = "no-store"
        return _attach_request_id(response)
    except ValueError as exc:
        return _error_response(str(exc), 400, "PDF_VALIDATION_FAILED")
    except Exception:
        return _internal_error_response("Storage PDF processing failed")
    finally:
        _cleanup_storage_paths(bucket, storage_paths)
        _cleanup_local_directory(temp_dir)
