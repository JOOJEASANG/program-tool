from __future__ import annotations

import json
import logging
import shutil
import tempfile
from pathlib import Path

import fitz
from flask import Blueprint, Response, jsonify, request

from models.advanced_schemas import PdfAdvancedProcessRequest
from services.pdf_advanced_engine import (
    process_advanced_pdf_bytes,
    process_advanced_pdf_paths,
)
from utils.auth import require_auth
from utils.storage import get_bucket, get_request_id
from utils.storage_delivery import upload_pdf_result


pdf_advanced_bp = Blueprint("pdf_advanced", __name__)
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


def _error(detail: str, status: int, code: str):
    response = jsonify({"detail": detail, "code": code, "request_id": _request_id()})
    response.status_code = status
    response.headers["X-Request-ID"] = _request_id()
    return response


def _attach(response):
    response.headers["X-Request-ID"] = _request_id()
    return response


def _validate_shape(req: PdfAdvancedProcessRequest, file_count: int) -> None:
    if file_count <= 0:
        raise ValueError("파일이 없습니다")
    if file_count > MAX_PDF_FILES:
        raise ValueError(f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다")
    if not req.pages:
        raise ValueError("출력할 페이지가 없습니다")
    if len(req.pages) > MAX_REQUEST_PAGES:
        raise ValueError(f"페이지는 최대 {MAX_REQUEST_PAGES}개까지 처리할 수 있습니다")


def _validate_documents(req: PdfAdvancedProcessRequest, docs: list[fitz.Document]) -> None:
    _validate_shape(req, len(docs))
    for page in req.pages:
        if page.excluded:
            continue
        if page.file_index >= len(docs):
            raise ValueError("페이지 정보의 파일 번호가 올바르지 않습니다")
        if page.page_index >= docs[page.file_index].page_count:
            raise ValueError("페이지 정보의 페이지 번호가 올바르지 않습니다")


def _validate_bytes(req: PdfAdvancedProcessRequest, files: list[bytes]) -> None:
    docs: list[fitz.Document] = []
    total = 0
    try:
        for data in files:
            if len(data) > MAX_PDF_FILE_BYTES:
                raise ValueError("파일이 200 MB를 초과합니다")
            total += len(data)
            if total > MAX_TOTAL_PDF_BYTES:
                raise ValueError("전체 파일 용량은 최대 300 MB까지 처리할 수 있습니다")
            try:
                docs.append(fitz.open(stream=data, filetype="pdf"))
            except Exception as exc:
                raise ValueError("유효한 PDF 파일이 아닙니다") from exc
        _validate_documents(req, docs)
    finally:
        for doc in docs:
            doc.close()


def _validate_paths(req: PdfAdvancedProcessRequest, paths: list[Path]) -> None:
    docs: list[fitz.Document] = []
    total = 0
    try:
        for path in paths:
            size = path.stat().st_size
            if size > MAX_PDF_FILE_BYTES:
                raise ValueError("파일이 200 MB를 초과합니다")
            total += size
            if total > MAX_TOTAL_PDF_BYTES:
                raise ValueError("전체 파일 용량은 최대 300 MB까지 처리할 수 있습니다")
            try:
                docs.append(fitz.open(str(path)))
            except Exception as exc:
                raise ValueError("유효한 PDF 파일이 아닙니다") from exc
        _validate_documents(req, docs)
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


def _cleanup_storage(bucket, paths: list[str]) -> None:
    if bucket is None:
        return
    for path in paths:
        try:
            bucket.blob(path).delete()
        except Exception:
            logger.warning("Advanced PDF temp cleanup failed path=%s", path, exc_info=True)


def _cleanup_local(path: str | Path) -> None:
    try:
        shutil.rmtree(path, ignore_errors=False)
    except FileNotFoundError:
        pass
    except Exception:
        logger.warning("Advanced PDF local cleanup failed path=%s", path, exc_info=True)


def _internal(message: str):
    logger.exception("%s request_id=%s", message, _request_id())
    return _error("고급 PDF 처리 중 오류가 발생했습니다.", 500, "PDF_ADVANCED_INTERNAL_ERROR")


@pdf_advanced_bp.route("/process", methods=["POST"])
@require_auth
def process(uid):
    try:
        req = PdfAdvancedProcessRequest.model_validate(
            json.loads(request.form.get("settings", "{}"))
        )
    except Exception:
        return _error("고급 PDF 편집 설정이 올바르지 않습니다.", 422, "PDF_ADVANCED_INVALID_SETTINGS")

    uploads = request.files.getlist("files")
    if not uploads:
        return _error("PDF 파일이 없습니다.", 400, "PDF_ADVANCED_FILES_REQUIRED")
    if len(uploads) > MAX_PDF_FILES:
        return _error("파일은 최대 50개까지 처리할 수 있습니다", 400, "PDF_ADVANCED_TOO_MANY_FILES")

    data_list: list[bytes] = []
    total = 0
    for upload in uploads:
        filename = upload.filename or "file.pdf"
        if not filename.lower().endswith(".pdf"):
            return _error("PDF 파일만 업로드할 수 있습니다", 400, "PDF_ADVANCED_INVALID_FILE_TYPE")
        data = upload.read(MAX_PDF_FILE_BYTES + 1)
        if len(data) > MAX_PDF_FILE_BYTES:
            return _error("파일이 200 MB를 초과합니다", 413, "PDF_ADVANCED_FILE_TOO_LARGE")
        total += len(data)
        data_list.append(data)

    if total > MAX_DIRECT_TOTAL_PDF_BYTES:
        return _error("직접 업로드는 전체 20 MB까지 지원합니다", 413, "PDF_ADVANCED_DIRECT_TOO_LARGE")

    try:
        _validate_bytes(req, data_list)
        output = process_advanced_pdf_bytes(data_list, req)
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_ADVANCED_VALIDATION_FAILED")
    except Exception:
        return _internal("Advanced direct PDF processing failed")

    if len(output) > MAX_DIRECT_RESPONSE_BYTES:
        try:
            delivery = upload_pdf_result(
                _bucket(), uid, filename="advanced-edited.pdf", data=output,
                metadata={"source": "pdf-advanced-direct"},
            )
            response = jsonify(delivery)
            response.headers["Cache-Control"] = "no-store"
            return _attach(response)
        except Exception:
            return _internal("Advanced direct result upload failed")

    return _attach(Response(
        output,
        status=200,
        mimetype="application/pdf",
        headers={"Content-Disposition": "attachment; filename=advanced-edited.pdf"},
    ))


@pdf_advanced_bp.route("/process-storage", methods=["POST"])
@require_auth
def process_storage(uid):
    try:
        body = request.get_json(force=True) or {}
        storage_paths = body.get("storage_paths", [])
        req = PdfAdvancedProcessRequest.model_validate(body.get("settings", {}))
    except Exception:
        return _error("고급 PDF 처리 요청이 올바르지 않습니다.", 422, "PDF_ADVANCED_INVALID_REQUEST")

    if not isinstance(storage_paths, list) or not storage_paths:
        return _error("PDF 파일 경로가 없습니다.", 400, "PDF_ADVANCED_STORAGE_PATHS_REQUIRED")
    if len(storage_paths) > MAX_PDF_FILES or len(storage_paths) != len(set(storage_paths)):
        return _error("PDF 파일 경로가 올바르지 않습니다.", 400, "PDF_ADVANCED_INVALID_STORAGE_PATHS")
    try:
        for path in storage_paths:
            _validate_storage_path(uid, path)
    except PermissionError as exc:
        return _error(str(exc), 403, "PDF_ADVANCED_STORAGE_FORBIDDEN")
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_ADVANCED_INVALID_STORAGE_PATH")

    bucket = None
    temp_dir = tempfile.mkdtemp(prefix="pdf-advanced-")
    output_path = Path(temp_dir) / "advanced-edited.pdf"
    try:
        bucket = _bucket()
        blobs = []
        declared_total = 0
        for storage_path in storage_paths:
            blob = bucket.blob(storage_path)
            try:
                blob.reload()
            except Exception:
                return _error("임시 PDF 파일을 찾을 수 없습니다. 다시 시도해 주세요.", 404, "PDF_ADVANCED_STORAGE_NOT_FOUND")
            size = int(blob.size or 0)
            if size > MAX_PDF_FILE_BYTES:
                return _error("파일이 200 MB를 초과합니다", 413, "PDF_ADVANCED_FILE_TOO_LARGE")
            declared_total += size
            if declared_total > MAX_TOTAL_PDF_BYTES:
                return _error("전체 파일 용량은 최대 300 MB까지 처리할 수 있습니다", 413, "PDF_ADVANCED_TOTAL_TOO_LARGE")
            blobs.append(blob)

        local_paths: list[Path] = []
        for index, blob in enumerate(blobs):
            path = Path(temp_dir) / f"source-{index:03d}.pdf"
            blob.download_to_filename(str(path))
            local_paths.append(path)

        _validate_paths(req, local_paths)
        process_advanced_pdf_paths(local_paths, req, output_path)
        delivery = upload_pdf_result(
            bucket,
            uid,
            filename="advanced-edited.pdf",
            source_path=output_path,
            metadata={"source": "pdf-advanced"},
        )
        response = jsonify(delivery)
        response.headers["Cache-Control"] = "no-store"
        return _attach(response)
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_ADVANCED_VALIDATION_FAILED")
    except Exception:
        return _internal("Advanced storage PDF processing failed")
    finally:
        _cleanup_storage(bucket, storage_paths)
        _cleanup_local(temp_dir)
