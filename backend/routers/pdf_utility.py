"""PDF Utility endpoints for bounded batch merge and background cleanup."""
from __future__ import annotations

import io
import logging
import re
import shutil
import tempfile
from pathlib import Path

import fitz
from PIL import Image
from flask import Blueprint, Response, jsonify, request

from utils.auth import require_auth
from utils.storage import get_bucket, get_request_id
from utils.storage_delivery import upload_pdf_result

pdf_utility_bp = Blueprint("pdf_utility", __name__)
logger = logging.getLogger(__name__)

MAX_FILES = 10
MAX_FILE_BYTES = 200 * 1024 * 1024
MAX_TOTAL_BYTES = 300 * 1024 * 1024
MAX_TOTAL_PAGES = 1000
MAX_BACKGROUND_PAGES = 100
MAX_BACKGROUND_PIXELS = 90_000_000
MAX_DIRECT_RESPONSE_BYTES = 20 * 1024 * 1024
BACKGROUND_DPI = 160

BACKGROUND_STRENGTHS = {
    "light": {"threshold": 238, "lift": 0.35, "label": "약하게"},
    "medium": {"threshold": 222, "lift": 0.58, "label": "보통"},
    "strong": {"threshold": 202, "lift": 0.78, "label": "강하게"},
}


def _bucket():
    return get_bucket()


def _request_id() -> str:
    return get_request_id()


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
    if "\x00" in value or ".." in value or value.startswith("/"):
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


def _storage_blob(uid: str, path: str):
    valid_path = _validate_storage_path(uid, path)
    blob = _bucket().blob(valid_path)
    blob.reload()
    size = int(blob.size or 0)
    if size <= 0:
        raise ValueError("빈 PDF 파일은 처리할 수 없습니다.")
    if size > MAX_FILE_BYTES:
        raise ValueError("PDF 한 파일은 최대 200MB까지 처리할 수 있습니다.")
    return blob, size


def _download_storage_pdf_to_path(uid: str, path: str, destination: str | Path) -> int:
    blob, declared_size = _storage_blob(uid, path)
    target = Path(destination)
    blob.download_to_filename(str(target))
    actual_size = target.stat().st_size
    if actual_size <= 0:
        raise ValueError("빈 PDF 파일은 처리할 수 없습니다.")
    if actual_size > MAX_FILE_BYTES:
        raise ValueError("PDF 한 파일은 최대 200MB까지 처리할 수 있습니다.")
    if declared_size and actual_size != declared_size:
        logger.warning(
            "PDF utility storage size changed path=%s declared=%s actual=%s request_id=%s",
            path,
            declared_size,
            actual_size,
            _request_id(),
        )
    return actual_size


def _download_storage_pdf(uid: str, path: str) -> bytes:
    """Small/test compatibility helper. Large production routes use local paths."""
    blob, _ = _storage_blob(uid, path)
    data = blob.download_as_bytes()
    if len(data) > MAX_FILE_BYTES:
        raise ValueError("PDF 한 파일은 최대 200MB까지 처리할 수 있습니다.")
    return data


def _open_pdf(data: bytes) -> fitz.Document:
    try:
        document = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ValueError("유효한 PDF 파일이 아닙니다.") from exc
    return _validate_open_document(document)


def _open_pdf_path(path: str | Path) -> fitz.Document:
    try:
        document = fitz.open(str(path))
    except Exception as exc:
        raise ValueError("유효한 PDF 파일이 아닙니다.") from exc
    return _validate_open_document(document)


def _validate_open_document(document: fitz.Document) -> fitz.Document:
    if document.is_encrypted:
        document.close()
        raise ValueError("암호화된 PDF는 먼저 암호를 해제하세요.")
    if document.page_count < 1:
        document.close()
        raise ValueError("페이지가 없는 PDF입니다.")
    return document


def _safe_pdf_filename(filename: str) -> str:
    safe_filename = _safe_name(filename, "pdf_utility.pdf")
    if not safe_filename.lower().endswith(".pdf"):
        safe_filename += ".pdf"
    return safe_filename


def _deliver_pdf(uid: str, data: bytes, filename: str, source: str):
    safe_filename = _safe_pdf_filename(filename)
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
    return Response(
        data,
        status=200,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
            "X-Request-ID": _request_id(),
        },
    )


def _deliver_pdf_path(uid: str, path: str | Path, filename: str, source: str):
    source_path = Path(path)
    size = source_path.stat().st_size
    if size <= 0:
        raise ValueError("완성 PDF 파일이 비어 있습니다.")
    safe_filename = _safe_pdf_filename(filename)
    if size <= MAX_DIRECT_RESPONSE_BYTES:
        return _deliver_pdf(uid, source_path.read_bytes(), safe_filename, source)
    delivery = upload_pdf_result(
        _bucket(),
        uid,
        filename=safe_filename,
        source_path=source_path,
        metadata={"source": source},
    )
    response = jsonify(delivery)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Request-ID"] = _request_id()
    return response


def _merge_pdf_bytes(items: list[tuple[str, bytes]]) -> tuple[bytes, int]:
    if not items:
        raise ValueError("합칠 PDF 파일이 없습니다.")
    if len(items) > MAX_FILES:
        raise ValueError(f"PDF 합치기는 최대 {MAX_FILES}개까지 가능합니다.")
    output = fitz.open()
    total_pages = 0
    try:
        for _filename, data in items:
            source = _open_pdf(data)
            try:
                total_pages += source.page_count
                if total_pages > MAX_TOTAL_PAGES:
                    raise ValueError(f"합칠 PDF의 전체 페이지는 최대 {MAX_TOTAL_PAGES}페이지까지 가능합니다.")
                output.insert_pdf(source)
            finally:
                source.close()
        if output.page_count < 1:
            raise ValueError("합친 PDF에 페이지가 없습니다.")
        buffer = io.BytesIO()
        output.save(buffer, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True)
        return buffer.getvalue(), total_pages
    finally:
        output.close()


def _merge_pdf_paths(paths: list[Path], output_path: Path) -> int:
    if not paths:
        raise ValueError("합칠 PDF 파일이 없습니다.")
    if len(paths) > MAX_FILES:
        raise ValueError(f"PDF 합치기는 최대 {MAX_FILES}개까지 가능합니다.")
    output = fitz.open()
    total_pages = 0
    try:
        for path in paths:
            source = _open_pdf_path(path)
            try:
                total_pages += source.page_count
                if total_pages > MAX_TOTAL_PAGES:
                    raise ValueError(f"합칠 PDF의 전체 페이지는 최대 {MAX_TOTAL_PAGES}페이지까지 가능합니다.")
                output.insert_pdf(source)
            finally:
                source.close()
        if output.page_count < 1:
            raise ValueError("합친 PDF에 페이지가 없습니다.")
        output.save(str(output_path), garbage=4, deflate=True, deflate_images=True, deflate_fonts=True)
        return total_pages
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


def _clean_background_document(source: fitz.Document, output: fitz.Document, strength: str) -> int:
    if source.page_count > MAX_BACKGROUND_PAGES:
        raise ValueError(f"배경색 제거는 최대 {MAX_BACKGROUND_PAGES}페이지까지 처리할 수 있습니다.")
    projected_pixels = 0
    for page in source:
        projected_pixels += int(
            page.rect.width * BACKGROUND_DPI / 72
            * page.rect.height * BACKGROUND_DPI / 72
        )
        if projected_pixels > MAX_BACKGROUND_PIXELS:
            raise ValueError("PDF 해상도와 페이지 수가 배경 제거 처리 한도를 초과합니다.")

    lut = _background_lut(strength)
    for page in source:
        pixmap = page.get_pixmap(
            dpi=BACKGROUND_DPI,
            colorspace=fitz.csRGB,
            alpha=False,
            annots=True,
        )
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        cleaned = image.point(lut * 3)
        jpeg_buffer = io.BytesIO()
        cleaned.save(
            jpeg_buffer,
            format="JPEG",
            quality=90,
            optimize=True,
            dpi=(BACKGROUND_DPI, BACKGROUND_DPI),
        )
        new_page = output.new_page(width=page.rect.width, height=page.rect.height)
        new_page.insert_image(new_page.rect, stream=jpeg_buffer.getvalue())
        image.close()
        cleaned.close()
    return source.page_count


def _clean_background_pdf(data: bytes, strength: str) -> tuple[bytes, int]:
    source = _open_pdf(data)
    output = fitz.open()
    try:
        page_count = _clean_background_document(source, output, strength)
        buffer = io.BytesIO()
        output.save(buffer, garbage=4, deflate=True, deflate_images=True)
        return buffer.getvalue(), page_count
    finally:
        output.close()
        source.close()


def _clean_background_pdf_path(source_path: Path, output_path: Path, strength: str) -> int:
    source = _open_pdf_path(source_path)
    output = fitz.open()
    try:
        page_count = _clean_background_document(source, output, strength)
        output.save(str(output_path), garbage=4, deflate=True, deflate_images=True)
        return page_count
    finally:
        output.close()
        source.close()


@pdf_utility_bp.route("/merge-storage", methods=["POST"])
@require_auth
def merge_storage(uid):
    payload = request.get_json(silent=True) or {}
    raw_paths = payload.get("storage_paths")
    if not isinstance(raw_paths, list) or not raw_paths:
        return _error("합칠 PDF 파일이 없습니다.", 400, "PDF_MERGE_FILES_REQUIRED")
    if len(raw_paths) > MAX_FILES:
        return _error(f"PDF 합치기는 최대 {MAX_FILES}개까지 가능합니다.", 413, "PDF_MERGE_FILE_LIMIT")

    paths: list[str] = []
    temp_dir = Path(tempfile.mkdtemp(prefix="pdf-utility-merge-"))
    try:
        paths = [_validate_storage_path(uid, path) for path in raw_paths]
        local_paths: list[Path] = []
        total_bytes = 0
        for index, path in enumerate(paths):
            local_path = temp_dir / f"source-{index:02d}.pdf"
            total_bytes += _download_storage_pdf_to_path(uid, path, local_path)
            if total_bytes > MAX_TOTAL_BYTES:
                return _error("PDF 합치기 전체 파일 용량은 최대 300MB까지 가능합니다.", 413, "PDF_MERGE_TOTAL_LIMIT")
            local_paths.append(local_path)

        output_path = temp_dir / "merged.pdf"
        total_pages = _merge_pdf_paths(local_paths, output_path)
        response = _deliver_pdf_path(uid, output_path, "PDF_합치기.pdf", "pdf-utility-merge")
        response.headers["X-PDF-File-Count"] = str(len(local_paths))
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
        shutil.rmtree(temp_dir, ignore_errors=True)


@pdf_utility_bp.route("/background-cleanup-storage", methods=["POST"])
@require_auth
def background_cleanup_storage(uid):
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("storage_path")
    strength = str(payload.get("strength") or "medium").strip().lower()
    filename = str(payload.get("filename") or "document.pdf")
    path = ""
    temp_dir = Path(tempfile.mkdtemp(prefix="pdf-utility-background-"))
    try:
        path = _validate_storage_path(uid, raw_path)
        source_path = temp_dir / "source.pdf"
        _download_storage_pdf_to_path(uid, path, source_path)
        output_path = temp_dir / "cleaned.pdf"
        page_count = _clean_background_pdf_path(source_path, output_path, strength)
        safe_name = f"{_safe_name(Path(filename).stem)}_배경색제거.pdf"
        response = _deliver_pdf_path(uid, output_path, safe_name, "pdf-utility-background")
        response.headers["X-PDF-Page-Count"] = str(page_count)
        response.headers["Access-Control-Expose-Headers"] = (
            "X-PDF-Page-Count, X-Request-ID, Content-Disposition"
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
        shutil.rmtree(temp_dir, ignore_errors=True)
