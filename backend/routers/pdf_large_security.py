"""Storage-backed PDF encrypt/decrypt for large PDF Utility files."""
from __future__ import annotations

import logging
import re
import tempfile
from pathlib import Path

import fitz
from flask import Blueprint, jsonify, request

from utils.auth import require_auth
from utils.storage import get_bucket, get_request_id
from utils.storage_delivery import upload_pdf_result

pdf_large_security_bp = Blueprint("pdf_large_security", __name__)
logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 200 * 1024 * 1024
MAX_PAGES = 2000


def _bucket():
    return get_bucket()


def _request_id() -> str:
    return get_request_id()


def _error(detail: str, status: int, code: str):
    response = jsonify({"detail": detail, "code": code, "request_id": _request_id()})
    response.status_code = status
    response.headers["X-Request-ID"] = _request_id()
    return response


def _safe_name(value: str | None) -> str:
    name = Path(str(value or "document.pdf")).name
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", name.rsplit(".", 1)[0]).strip("._-")[:80]
    return stem or "document"


def _validate_path(uid: str, raw: object) -> str:
    path = str(raw or "").strip()
    if not path or ".." in path or path.startswith("/"):
        raise ValueError("잘못된 Storage 파일 경로입니다.")
    if not path.startswith(f"pdf_temp/{uid}/"):
        raise PermissionError("이 파일에 접근할 권한이 없습니다.")
    if not path.lower().endswith(".pdf"):
        raise ValueError("PDF 파일만 처리할 수 있습니다.")
    return path


def _delete_input(path: str) -> None:
    if not path:
        return
    try:
        _bucket().blob(path).delete()
    except Exception:
        logger.warning("PDF security temp cleanup failed path=%s", path, exc_info=True)


@pdf_large_security_bp.route("/security-storage", methods=["POST"])
@require_auth
def security_storage(uid):
    payload = request.get_json(silent=True) or {}
    operation = str(payload.get("operation") or "").strip().lower()
    password = str(payload.get("password") or "")
    path = ""
    try:
        if operation not in {"encrypt", "decrypt"}:
            return _error("암호 작업 종류가 올바르지 않습니다.", 400, "PDF_SECURITY_OPERATION_INVALID")
        if operation == "encrypt" and not (4 <= len(password) <= 32):
            return _error("비밀번호는 4~32자로 입력하세요.", 400, "PDF_SECURITY_PASSWORD_INVALID")

        path = _validate_path(uid, payload.get("storage_path"))
        blob = _bucket().blob(path)
        try:
            blob.reload()
        except Exception:
            return _error("업로드된 PDF를 찾을 수 없습니다. 다시 시도해 주세요.", 404, "PDF_SECURITY_FILE_NOT_FOUND")
        size = int(blob.size or 0)
        if size <= 0:
            return _error("빈 PDF 파일은 처리할 수 없습니다.", 400, "PDF_SECURITY_FILE_EMPTY")
        if size > MAX_FILE_BYTES:
            return _error("PDF 한 파일은 최대 200MB까지 처리할 수 있습니다.", 413, "PDF_SECURITY_FILE_TOO_LARGE")

        with tempfile.TemporaryDirectory(prefix="pdf-security-") as temp_dir:
            source_path = Path(temp_dir) / "source.pdf"
            output_path = Path(temp_dir) / "output.pdf"
            blob.download_to_filename(str(source_path))
            if source_path.stat().st_size > MAX_FILE_BYTES:
                return _error("PDF 한 파일은 최대 200MB까지 처리할 수 있습니다.", 413, "PDF_SECURITY_FILE_TOO_LARGE")

            try:
                document = fitz.open(str(source_path))
            except Exception:
                return _error("유효한 PDF 파일이 아닙니다.", 400, "PDF_SECURITY_INVALID_PDF")
            try:
                if document.page_count < 1:
                    return _error("페이지가 없는 PDF입니다.", 400, "PDF_SECURITY_EMPTY_PDF")
                if document.page_count > MAX_PAGES:
                    return _error(f"암호 작업은 최대 {MAX_PAGES}페이지까지 처리할 수 있습니다.", 413, "PDF_SECURITY_PAGE_LIMIT")

                source_name = _safe_name(payload.get("filename"))
                if operation == "decrypt":
                    if document.is_encrypted and not document.authenticate(password):
                        return _error("비밀번호가 올바르지 않습니다.", 403, "PDF_SECURITY_PASSWORD_WRONG")
                    document.save(
                        str(output_path),
                        encryption=fitz.PDF_ENCRYPT_NONE,
                        garbage=4,
                        deflate=True,
                    )
                    output_name = f"{source_name}_암호해제.pdf"
                else:
                    if document.is_encrypted:
                        return _error("이미 암호화된 PDF입니다. 먼저 암호를 해제하세요.", 400, "PDF_SECURITY_ALREADY_ENCRYPTED")
                    permissions = (
                        fitz.PDF_PERM_PRINT
                        | fitz.PDF_PERM_COPY
                        | fitz.PDF_PERM_ANNOTATE
                        | fitz.PDF_PERM_FORM
                        | fitz.PDF_PERM_ACCESSIBILITY
                        | fitz.PDF_PERM_ASSEMBLE
                        | fitz.PDF_PERM_PRINT_HQ
                    )
                    document.save(
                        str(output_path),
                        encryption=fitz.PDF_ENCRYPT_AES_256,
                        owner_pw=password,
                        user_pw=password,
                        permissions=permissions,
                        garbage=4,
                        deflate=True,
                    )
                    output_name = f"{source_name}_암호설정.pdf"
            finally:
                document.close()

            if not output_path.exists() or output_path.stat().st_size <= 0:
                return _error("완성 PDF를 만들지 못했습니다.", 500, "PDF_SECURITY_OUTPUT_EMPTY")
            delivery = upload_pdf_result(
                _bucket(),
                uid,
                filename=output_name,
                source_path=output_path,
                metadata={"source": f"pdf-utility-{operation}"},
            )
            response = jsonify(delivery)
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Request-ID"] = _request_id()
            return response
    except PermissionError as exc:
        return _error(str(exc), 403, "PDF_SECURITY_STORAGE_FORBIDDEN")
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_SECURITY_VALIDATION_FAILED")
    except Exception:
        logger.exception("PDF security operation failed request_id=%s", _request_id())
        return _error("PDF 암호 처리 중 오류가 발생했습니다.", 500, "PDF_SECURITY_INTERNAL_ERROR")
    finally:
        _delete_input(path)