"""PDF Utility endpoints for bounded batch merge and background cleanup."""
from __future__ import annotations

import io
import logging
import os
import re
import uuid

import firebase_admin.storage as fa_storage
import fitz
from PIL import Image
from flask import Blueprint, Response, g, has_request_context, jsonify, request

from utils.auth import require_auth
from utils.storage_delivery import upload_pdf_result

pdf_utility_bp = Blueprint("pdf_utility", __name__)
logger = logging.getLogger(__name__)

MAX_FILES = 10
MAX_FILE_BYTES = 200 * 1024 * 1024
MAX_TOTAL_BYTES = 200 * 1024 * 1024
MAX_TOTAL_PAGES = 1000
MAX_BACKGROUND_PAGES = 120
MAX_BACKGROUND_PIXELS = 120_000_000
MAX_DIRECT_RESPONSE_BYTES = 20 * 1024 * 1024
BACKGROUND_DPI = 180
DEFAULT_STORAGE_BUCKET = os.environ.get(
    "FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app"
)

BACKGROUND_STRENGTHS = {
    "light": {"threshold": 238, "lift": 0.35, "label": "약하게"},
    "medium": {"threshold": 222, "lift": 0.58, "label": "보통"},
    "strong": {"threshold": 202, "lift": 0.78, "label": "강하게"},
}


def _bucket():
    return fa_storage.bucket(DEFAULT_STORAGE_BUCKET)


def _request_id() -> str:
    if not has_request_context():
        return uuid.uuid4().hex[:16]
    cached = getattr(g, "pdf_utility_request_id", None)
    if isinstance(cached, str) and cached:
        return cached
    supplied = (request.headers.get("X-Request-ID") or "").strip()
    request_id = (
        supplied
        if re.fullmatch(r"[A-Za-z0-9._-]{8,64}", supplied)
        else uuid.uuid4().hex[:16]
    )
    g.pdf_utility_request_id = request_id
    return request_id


def _error(detail: str, status: int, code: str):
    response = jsonify(
        {"detail": detail, "code": code, "request_id": _request_id()}
    )
    response.status_code = status
    response.headers["X-Request-ID"] = _request_id()
    return response


def _internal_error(operation: str):
    logger.exception("%s failed request_id=%s", operation, _request_id())
    return _error(
        "PDF 처리 중 오류가 발생했습니다.",
        500,
        "PDF_UTILITY_INTERNAL_ERROR",
    )


def _safe_name(value: str | None, fallback: str = "document") -> str:
    base = str(value or fallback).rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._-")[:90]
    return base or fallback


def _validate_storage_path(uid: str, path: str | None) -> str:
    value = str(path or "").strip()
    if not value:
        raise ValueError("Storage 파일 경로가 없습니다.")
    if ".." in value or value.startswith("/"):
        raise ValueError("잘못된 Storage 파일 경로입니다.")
    if not value.startswith(f"pdf_temp/{uid}/"):
        raise PermissionError("이 파일에 접근할 권한이 없습니다.")
    if not value.lower().endswith(".pdf"):
        raise ValueError("PDF 파일만 처리할 수 있습니다.")
    return value


def _delete_storage_paths(paths: list[str]) -> None:
    bucket = _bucket()
    for path in paths:
        try:
            bucket.blob(path).delete()
        except Exception:
            logger.warning(
                "PDF utility temp cleanup failed path=%s request_id=%s",
                path,
                _request_id(),
                exc_info=True,
            )


def _download_storage_pdf(uid: str, path: str) -> bytes:
    valid_path = _validate_storage_path(uid, path)
    blob = _bucket().blob(valid_path)
    blob.reload()
    size = int(blob.size or 0)
    if size <= 0:
        raise ValueError("빈 PDF 파일은 처리할 수 없습니다.")
    if size > MAX_FILE_BYTES:
        raise ValueError("PDF 한 파일은 최대 200MB까지 처리할 수 있습니다.")
    data = blob.download_as_bytes()
    if len(data) > MAX_FILE_BYTES:
        raise ValueError("PDF 한 파일은 최대 200MB까지 처리할 수 있습니다.")
    return data


def _open_pdf(data: bytes) -> fitz.Document:
    try:
        document = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ValueError("유효한 PDF 파일이 아닙니다.") from exc
    if document.is_encrypted:
        document.close()
        raise ValueError("암호화된 PDF는 먼저 암호를 해제하세요.")
    if document.page_count < 1:
        document.close()
        raise ValueError("페이지가 없는 PDF입니다.")
    return document


def _deliver_pdf(uid: str, data: bytes, filename: str, source: str):
    safe_filename = _safe_name(filename, "pdf_utility.pdf")
    if not safe_filename.lower().endswith(".pdf"):
        safe_filename += ".pdf"
    if len(data) > MAX_DIRECT_RESPONSE_BYTES:
        delivery = upload_pdf_result(
            _bucket(),
            uid,
            filename=safe_filename,
            data=data,
            metadata={"source": source},
        )
        response = jsonify(delivery)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Request-ID"] = _request_id()
        return response
    response = Response(
        data,
        status=200,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
            "X-Request-ID": _request_id(),
        },
    )
    return response


def _merge_pdf_bytes(items: list[tuple[str, bytes]]) -> tuple[bytes, int]:
    if not items:
        raise ValueError("합칠 PDF 파일이 없습니다.")
    if len(items) > MAX_FILES:
        raise ValueError(f"PDF 합치기는 최대 {MAX_FILES}개까지 가능합니다.")

    output = fitz.open()
    total_pages = 0
    try:
        for filename, data in items:
            source = _open_pdf(data)
            try:
                total_pages += source.page_count
                if total_pages > MAX_TOTAL_PAGES:
                    raise ValueError(
                        f"합칠 PDF의 전체 페이지는 최대 {MAX_TOTAL_PAGES}페이지까지 가능합니다."
                    )
                output.insert_pdf(source)
            finally:
                source.close()
        if output.page_count < 1:
            raise ValueError("합친 PDF에 페이지가 없습니다.")
        buffer = io.BytesIO()
        output.save(
            buffer,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
        )
        return buffer.getvalue(), total_pages
    finally:
        output.close()


def _background_lut(strength: str) -> list[int]:
    setting = BACKGROUND_STRENGTHS.get(strength)
    if setting is None:
        raise ValueError("배경 제거 강도 설정이 올바르지 않습니다.")
    threshold = int(setting["threshold"])
    lift = float(setting["lift"])
    dark_guard = 72
    table: list[int] = []
    for value in range(256):
        if value >= threshold:
            table.append(255)
            continue
        if value <= dark_guard:
            table.append(value)
            continue
        progress = (value - dark_guard) / max(1, threshold - dark_guard)
        amount = lift * max(0.0, min(1.0, progress))
        table.append(min(255, round(value + (255 - value) * amount)))
    return table


def _clean_background_pdf(data: bytes, strength: str) -> tuple[bytes, int]:
    source = _open_pdf(data)
    output = fitz.open()
    try:
        if source.page_count > MAX_BACKGROUND_PAGES:
            raise ValueError(
                f"배경색 제거는 최대 {MAX_BACKGROUND_PAGES}페이지까지 처리할 수 있습니다."
            )
        projected_pixels = 0
        for page in source:
            projected_pixels += int(
                page.rect.width * BACKGROUND_DPI / 72
                * page.rect.height * BACKGROUND_DPI / 72
            )
            if projected_pixels > MAX_BACKGROUND_PIXELS:
                raise ValueError(
                    "PDF 해상도와 페이지 수가 배경 제거 처리 한도를 초과합니다."
                )

        lut = _background_lut(strength)
        for page in source:
            pixmap = page.get_pixmap(
                dpi=BACKGROUND_DPI,
                colorspace=fitz.csRGB,
                alpha=False,
                annots=True,
            )
            image = Image.frombytes(
                "RGB",
                (pixmap.width, pixmap.height),
                pixmap.samples,
            )
            cleaned = image.point(lut * 3)
            jpeg_buffer = io.BytesIO()
            cleaned.save(
                jpeg_buffer,
                format="JPEG",
                quality=92,
                optimize=True,
                dpi=(BACKGROUND_DPI, BACKGROUND_DPI),
            )
            new_page = output.new_page(width=page.rect.width, height=page.rect.height)
            new_page.insert_image(new_page.rect, stream=jpeg_buffer.getvalue())

        buffer = io.BytesIO()
        output.save(
            buffer,
            garbage=4,
            deflate=True,
            deflate_images=True,
        )
        return buffer.getvalue(), source.page_count
    finally:
        output.close()
        source.close()


@pdf_utility_bp.route("/merge-storage", methods=["POST"])
@require_auth
def merge_storage(uid):
    payload = request.get_json(silent=True) or {}
    raw_paths = payload.get("storage_paths")
    raw_names = payload.get("filenames")
    if not isinstance(raw_paths, list) or not raw_paths:
        return _error("합칠 PDF 파일이 없습니다.", 400, "PDF_MERGE_FILES_REQUIRED")
    if len(raw_paths) > MAX_FILES:
        return _error(
            f"PDF 합치기는 최대 {MAX_FILES}개까지 가능합니다.",
            413,
            "PDF_MERGE_FILE_LIMIT",
        )
    names = raw_names if isinstance(raw_names, list) else []
    paths: list[str] = []
    try:
        paths = [_validate_storage_path(uid, path) for path in raw_paths]
        items: list[tuple[str, bytes]] = []
        total_bytes = 0
        for index, path in enumerate(paths):
            data = _download_storage_pdf(uid, path)
            total_bytes += len(data)
            if total_bytes > MAX_TOTAL_BYTES:
                return _error(
                    "PDF 합치기 전체 파일 용량은 최대 200MB까지 가능합니다.",
                    413,
                    "PDF_MERGE_TOTAL_LIMIT",
                )
            name = names[index] if index < len(names) else f"document_{index + 1}.pdf"
            items.append((_safe_name(name, f"document_{index + 1}.pdf"), data))
        merged, total_pages = _merge_pdf_bytes(items)
        response = _deliver_pdf(uid, merged, "PDF_합치기.pdf", "pdf-utility-merge")
        response.headers["X-PDF-File-Count"] = str(len(items))
        response.headers["X-PDF-Page-Count"] = str(total_pages)
        response.headers["Access-Control-Expose-Headers"] = (
            "X-PDF-File-Count, X-PDF-Page-Count, X-Request-ID, Content-Disposition"
        )
        return response
    except PermissionError as exc:
        return _error(str(exc), 403, "PDF_UTILITY_STORAGE_FORBIDDEN")
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_UTILITY_VALIDATION_FAILED")
    except Exception:
        return _internal_error("PDF utility merge")
    finally:
        if paths:
            _delete_storage_paths(paths)


@pdf_utility_bp.route("/background-cleanup-storage", methods=["POST"])
@require_auth
def background_cleanup_storage(uid):
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("storage_path")
    strength = str(payload.get("strength") or "medium").strip().lower()
    path = ""
    try:
        path = _validate_storage_path(uid, raw_path)
        data = _download_storage_pdf(uid, path)
        cleaned, page_count = _clean_background_pdf(data, strength)
        source_name = _safe_name(payload.get("filename"), "document.pdf")
        base = source_name[:-4] if source_name.lower().endswith(".pdf") else source_name
        response = _deliver_pdf(
            uid,
            cleaned,
            f"{base}_배경제거.pdf",
            "pdf-utility-background-cleanup",
        )
        response.headers["X-PDF-Page-Count"] = str(page_count)
        response.headers["X-Background-Strength"] = strength
        response.headers["Access-Control-Expose-Headers"] = (
            "X-PDF-Page-Count, X-Background-Strength, X-Request-ID, Content-Disposition"
        )
        return response
    except PermissionError as exc:
        return _error(str(exc), 403, "PDF_UTILITY_STORAGE_FORBIDDEN")
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_UTILITY_VALIDATION_FAILED")
    except Exception:
        return _internal_error("PDF utility background cleanup")
    finally:
        if path:
            _delete_storage_paths([path])
