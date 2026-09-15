"""Storage-backed utility operations for PDFs too large for direct multipart."""
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

pdf_utility_large_tools_bp = Blueprint("pdf_utility_large_tools", __name__)
logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 500 * 1024 * 1024
MAX_PAGES = 2000


def _error(detail: str, status: int, code: str):
    response = jsonify({"detail": detail, "code": code, "request_id": get_request_id()})
    response.status_code = status
    response.headers["X-Request-ID"] = get_request_id()
    return response


def _safe_name(value: object) -> str:
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
        get_bucket().blob(path).delete()
    except Exception:
        logger.warning("Large utility temp cleanup failed path=%s", path, exc_info=True)


def _page_is_blank(page: fitz.Page) -> bool:
    """Conservatively treat a page as blank only when it has no visible primitives."""
    if (page.get_text("text") or "").strip():
        return False
    try:
        if page.get_images(full=True):
            return False
    except Exception:
        return False
    try:
        drawings = page.get_drawings()
        if drawings:
            return False
    except Exception:
        return False
    try:
        blocks = page.get_text("blocks") or []
        if any(str(block[4] if len(block) > 4 else "").strip() for block in blocks):
            return False
    except Exception:
        return False
    return True


@pdf_utility_large_tools_bp.route("/remove-blank-storage", methods=["POST"])
@require_auth
def remove_blank_storage(uid):
    payload = request.get_json(silent=True) or {}
    path = ""
    try:
        path = _validate_path(uid, payload.get("storage_path"))
        bucket = get_bucket()
        blob = bucket.blob(path)
        try:
            blob.reload()
        except Exception:
            return _error("업로드된 PDF를 찾을 수 없습니다. 다시 시도해 주세요.", 404, "PDF_UTILITY_FILE_NOT_FOUND")
        size = int(blob.size or 0)
        if size <= 0:
            return _error("빈 PDF 파일은 처리할 수 없습니다.", 400, "PDF_UTILITY_FILE_EMPTY")
        if size > MAX_FILE_BYTES:
            return _error("PDF 한 파일은 최대 500MB까지 처리할 수 있습니다.", 413, "PDF_UTILITY_FILE_TOO_LARGE")

        with tempfile.TemporaryDirectory(prefix="pdf-remove-blank-") as temp_dir:
            source_path = Path(temp_dir) / "source.pdf"
            output_path = Path(temp_dir) / "output.pdf"
            blob.download_to_filename(str(source_path))
            if source_path.stat().st_size > MAX_FILE_BYTES:
                return _error("PDF 한 파일은 최대 500MB까지 처리할 수 있습니다.", 413, "PDF_UTILITY_FILE_TOO_LARGE")

            try:
                source = fitz.open(str(source_path))
            except Exception:
                return _error("유효한 PDF 파일이 아닙니다.", 400, "PDF_UTILITY_INVALID_PDF")
            output = fitz.open()
            removed: list[int] = []
            try:
                if source.is_encrypted:
                    return _error("암호화된 PDF는 먼저 암호를 해제해 주세요.", 400, "PDF_UTILITY_ENCRYPTED")
                if source.page_count < 1:
                    return _error("페이지가 없는 PDF입니다.", 400, "PDF_UTILITY_EMPTY_PDF")
                if source.page_count > MAX_PAGES:
                    return _error(f"빈 페이지 제거는 최대 {MAX_PAGES}페이지까지 처리할 수 있습니다.", 413, "PDF_UTILITY_PAGE_LIMIT")

                for index in range(source.page_count):
                    if _page_is_blank(source[index]):
                        removed.append(index + 1)
                    else:
                        output.insert_pdf(source, from_page=index, to_page=index)
                if output.page_count < 1:
                    return _error("모든 페이지가 빈 페이지로 판단되어 결과 파일을 만들지 않았습니다.", 422, "PDF_UTILITY_ALL_BLANK")
                output.save(str(output_path), garbage=4, deflate=True, deflate_images=True)
            finally:
                output.close()
                source.close()

            delivery = upload_pdf_result(
                bucket,
                uid,
                filename=f"{_safe_name(payload.get('filename'))}_빈페이지제거.pdf",
                source_path=output_path,
                metadata={
                    "source": "pdf-utility-remove-blank",
                    "removedBlankPages": ",".join(map(str, removed[:200])),
                },
            )
            delivery["removed_pages"] = removed
            delivery["removed_count"] = len(removed)
            response = jsonify(delivery)
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Request-ID"] = get_request_id()
            return response
    except PermissionError as exc:
        return _error(str(exc), 403, "PDF_UTILITY_STORAGE_FORBIDDEN")
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_UTILITY_VALIDATION_FAILED")
    except Exception:
        logger.exception("Large utility remove blank failed request_id=%s", get_request_id())
        return _error("빈 페이지 제거 중 오류가 발생했습니다.", 500, "PDF_UTILITY_INTERNAL_ERROR")
    finally:
        _delete_input(path)