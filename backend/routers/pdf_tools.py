"""Standalone PDF utilities with bounded resource use and safe error responses."""
from __future__ import annotations

import io
import logging
import os
import re
import uuid

import firebase_admin.storage as fa_storage
import fitz
from flask import Blueprint, Response, g, has_request_context, jsonify, request

from utils.auth import require_auth
from utils.storage_delivery import upload_pdf_result

pdf_tools_bp = Blueprint("pdf_tools", __name__)
logger = logging.getLogger(__name__)

MAX_FILE = 20 * 1024 * 1024
MAX_IMAGE_FILES = 30
MAX_IMAGE_TOTAL_BYTES = 20 * 1024 * 1024
MAX_IMAGE_PIXELS_PER_FILE = 40_000_000
MAX_IMAGE_PIXELS_TOTAL = 120_000_000
MAX_DIRECT_RESPONSE_BYTES = 20 * 1024 * 1024
MAX_COMPRESS_PAGES = 200
MAX_COMPRESS_PIXELS_TOTAL = 180_000_000
MAX_REMOVE_BLANK_PAGES = 500
MAX_RANGE_SPEC_LENGTH = 4096
MAX_RANGE_TOKENS = 512
DEFAULT_STORAGE_BUCKET = os.environ.get(
    "FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app"
)


def _bucket():
    return fa_storage.bucket(DEFAULT_STORAGE_BUCKET)


def _request_id() -> str:
    if not has_request_context():
        return uuid.uuid4().hex[:16]
    cached = getattr(g, "pdf_tool_request_id", None)
    if isinstance(cached, str) and cached:
        return cached
    supplied = (request.headers.get("X-Request-ID") or "").strip()
    request_id = (
        supplied
        if re.fullmatch(r"[A-Za-z0-9._-]{8,64}", supplied)
        else uuid.uuid4().hex[:16]
    )
    g.pdf_tool_request_id = request_id
    return request_id


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
        "PDF_TOOL_INTERNAL_ERROR",
    )


def _read_pdf(files_key: str = "file") -> bytes:
    uploaded = request.files.get(files_key)
    if not uploaded:
        raise ValueError("파일이 없습니다.")
    if not (uploaded.filename or "").lower().endswith(".pdf"):
        raise ValueError("PDF 파일만 처리할 수 있습니다.")
    data = uploaded.read(MAX_FILE + 1)
    if len(data) > MAX_FILE:
        raise ValueError("파일이 20MB를 초과합니다.")
    return data


def _open_pdf(data: bytes) -> fitz.Document:
    try:
        document = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ValueError("유효한 PDF 파일이 아닙니다.") from exc
    if document.is_encrypted:
        document.close()
        raise ValueError("암호화된 PDF는 먼저 암호를 해제하세요.")
    return document


def _pdf_response(data: bytes, filename: str, uid: str) -> Response:
    if len(data) > MAX_DIRECT_RESPONSE_BYTES:
        delivery = upload_pdf_result(
            _bucket(),
            uid,
            filename=filename,
            data=data,
            metadata={"source": "pdf-tool"},
        )
        response = jsonify(delivery)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Request-ID"] = _request_id()
        return response
    response = Response(
        data,
        status=200,
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
    response.headers["X-Request-ID"] = _request_id()
    return response


def _parse_ranges(spec: str, total: int) -> list[int]:
    """Parse a bounded '1-3,5,7-9' page range into zero-based indexes."""
    raw = str(spec or "").strip()
    if len(raw) > MAX_RANGE_SPEC_LENGTH:
        raise ValueError("페이지 범위 입력이 너무 깁니다.")
    chunks = [chunk for chunk in re.split(r"[,\s]+", raw) if chunk]
    if len(chunks) > MAX_RANGE_TOKENS:
        raise ValueError("페이지 범위 항목이 너무 많습니다.")

    pages: set[int] = set()
    for chunk in chunks:
        match = re.fullmatch(r"(\d+)\s*-\s*(\d+)", chunk)
        if match:
            left, right = (int(value) for value in match.groups())
            start = max(1, min(left, right))
            end = min(total, max(left, right))
            if start <= end:
                pages.update(range(start - 1, end))
            continue
        if chunk.isdigit():
            page = int(chunk)
            if 1 <= page <= total:
                pages.add(page - 1)
    return sorted(pages)


@pdf_tools_bp.route("/extract", methods=["POST"])
@require_auth
def extract(uid):
    source = output = None
    try:
        data = _read_pdf()
        ranges = (request.form.get("ranges") or "").strip()
        if not ranges:
            return _error(
                "페이지 범위를 입력하세요. 예: 1-3,5,7-9",
                400,
                "PAGE_RANGE_REQUIRED",
            )
        source = _open_pdf(data)
        indexes = _parse_ranges(ranges, len(source))
        if not indexes:
            return _error("유효한 페이지가 없습니다.", 400, "PAGE_RANGE_EMPTY")
        output = fitz.open()
        for index in indexes:
            output.insert_pdf(source, from_page=index, to_page=index)
        buffer = io.BytesIO()
        output.save(buffer, garbage=4, deflate=True)
        return _pdf_response(buffer.getvalue(), "extracted.pdf", uid)
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_TOOL_VALIDATION_FAILED")
    except Exception:
        return _internal_error("PDF extract")
    finally:
        if output is not None:
            output.close()
        if source is not None:
            source.close()

def _image_filetype(filename: str) -> str:
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    aliases = {"jpeg": "jpg", "jpe": "jpg", "tif": "tiff"}
    return aliases.get(extension, extension or "jpg")


@pdf_tools_bp.route("/from-images", methods=["POST"])
@require_auth
def from_images(uid):
    output = fitz.open()
    try:
        files = request.files.getlist("files")
        if not files:
            return _error("이미지가 없습니다.", 400, "IMAGE_FILES_REQUIRED")
        if len(files) > MAX_IMAGE_FILES:
            return _error(
                f"이미지는 최대 {MAX_IMAGE_FILES}개까지 처리할 수 있습니다.",
                413,
                "IMAGE_FILE_COUNT_EXCEEDED",
            )
        page_size = (request.form.get("size") or "fit").lower()
        if page_size not in {"fit", "a4"}:
            return _error("페이지 크기 설정이 올바르지 않습니다.", 400, "IMAGE_SIZE_INVALID")

        total_bytes = 0
        total_pixels = 0
        for uploaded in files:
            data = uploaded.read(MAX_FILE + 1)
            if len(data) > MAX_FILE:
                return _error(
                    "이미지 한 개의 크기는 20MB 이하여야 합니다.",
                    413,
                    "IMAGE_FILE_TOO_LARGE",
                )
            total_bytes += len(data)
            if total_bytes > MAX_IMAGE_TOTAL_BYTES:
                return _error(
                    "이미지 전체 용량은 20MB 이하여야 합니다.",
                    413,
                    "IMAGE_TOTAL_TOO_LARGE",
                )

            image_doc = None
            try:
                image_doc = fitz.open(
                    stream=data,
                    filetype=_image_filetype(uploaded.filename or ""),
                )
                if image_doc.page_count < 1:
                    raise ValueError("페이지가 없는 이미지입니다.")
                for image_page in image_doc:
                    source_rect = image_page.rect
                    projected_pixels = int(
                        source_rect.width * 200 / 72
                        * source_rect.height * 200 / 72
                    )
                    if projected_pixels > MAX_IMAGE_PIXELS_PER_FILE:
                        raise ValueError("이미지 해상도가 너무 큽니다.")
                    if total_pixels + projected_pixels > MAX_IMAGE_PIXELS_TOTAL:
                        raise ValueError("전체 이미지 해상도가 처리 한도를 초과합니다.")
                    pixmap = image_page.get_pixmap(dpi=200, alpha=False)
                    pixels = pixmap.width * pixmap.height
                    if pixels > MAX_IMAGE_PIXELS_PER_FILE:
                        raise ValueError("이미지 해상도가 너무 큽니다.")
                    total_pixels += pixels
                    if total_pixels > MAX_IMAGE_PIXELS_TOTAL:
                        raise ValueError("전체 이미지 해상도가 처리 한도를 초과합니다.")

                    if page_size == "a4":
                        page = output.new_page(width=595.28, height=841.89)
                        target = page.rect
                        scale = min(
                            target.width / pixmap.width,
                            target.height / pixmap.height,
                        )
                        width = pixmap.width * scale
                        height = pixmap.height * scale
                        x0 = (target.width - width) / 2
                        y0 = (target.height - height) / 2
                        target = fitz.Rect(x0, y0, x0 + width, y0 + height)
                    else:
                        if source_rect.width <= 0 or source_rect.height <= 0:
                            raise ValueError("이미지 크기가 올바르지 않습니다.")
                        page = output.new_page(
                            width=source_rect.width,
                            height=source_rect.height,
                        )
                        target = page.rect
                    page.insert_image(target, pixmap=pixmap)
            except ValueError:
                raise
            except Exception as exc:
                raise ValueError("지원되지 않거나 손상된 이미지가 포함되어 있습니다.") from exc
            finally:
                if image_doc is not None:
                    image_doc.close()

        if output.page_count == 0:
            return _error("변환할 이미지 페이지가 없습니다.", 400, "IMAGE_OUTPUT_EMPTY")
        buffer = io.BytesIO()
        output.save(buffer, garbage=4, deflate=True, deflate_images=True)
        return _pdf_response(buffer.getvalue(), "from_images.pdf", uid)
    except ValueError as exc:
        return _error(str(exc), 413, "IMAGE_LIMIT_EXCEEDED")
    except Exception:
        return _internal_error("Images to PDF")
    finally:
        output.close()


@pdf_tools_bp.route("/compress", methods=["POST"])
@require_auth
def compress(uid):
    source = output = None
    try:
        data = _read_pdf()
        quality = request.form.get("quality") or "medium"
        dpi_map = {"low": 100, "medium": 150, "high": 200}
        jpg_quality_map = {"low": 50, "medium": 70, "high": 85}
        if quality not in dpi_map:
            return _error("압축 품질 설정이 올바르지 않습니다.", 400, "QUALITY_INVALID")
        dpi = dpi_map[quality]
        jpg_quality = jpg_quality_map[quality]

        source = _open_pdf(data)
        if len(source) > MAX_COMPRESS_PAGES:
            return _error(
                f"압축은 최대 {MAX_COMPRESS_PAGES}페이지까지 처리할 수 있습니다.",
                413,
                "COMPRESS_PAGE_LIMIT",
            )
        projected_pixels = 0
        for page in source:
            projected_pixels += int(
                page.rect.width * dpi / 72 * page.rect.height * dpi / 72
            )
            if projected_pixels > MAX_COMPRESS_PIXELS_TOTAL:
                return _error(
                    "PDF 해상도와 페이지 수가 압축 처리 한도를 초과합니다.",
                    413,
                    "COMPRESS_PIXEL_LIMIT",
                )

        output = fitz.open()
        for page in source:
            pixmap = page.get_pixmap(dpi=dpi, alpha=False)
            jpeg = pixmap.tobytes("jpeg", jpg_quality=jpg_quality)
            new_page = output.new_page(
                width=page.rect.width,
                height=page.rect.height,
            )
            new_page.insert_image(new_page.rect, stream=jpeg)

        buffer = io.BytesIO()
        output.save(
            buffer,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
        )
        return _pdf_response(buffer.getvalue(), "compressed.pdf", uid)
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_TOOL_VALIDATION_FAILED")
    except Exception:
        return _internal_error("PDF compress")
    finally:
        if output is not None:
            output.close()
        if source is not None:
            source.close()


@pdf_tools_bp.route("/encrypt", methods=["POST"])
@require_auth
def encrypt(uid):
    source = None
    try:
        data = _read_pdf()
        password = (request.form.get("password") or "").strip()
        if len(password) < 4:
            return _error("비밀번호는 4자 이상 입력하세요.", 400, "PASSWORD_TOO_SHORT")
        if len(password) > 32:
            return _error("비밀번호는 32자 이내로 입력하세요.", 400, "PASSWORD_TOO_LONG")
        source = _open_pdf(data)
        buffer = io.BytesIO()
        permissions = (
            fitz.PDF_PERM_PRINT
            | fitz.PDF_PERM_COPY
            | fitz.PDF_PERM_ANNOTATE
            | fitz.PDF_PERM_FORM
            | fitz.PDF_PERM_ACCESSIBILITY
            | fitz.PDF_PERM_ASSEMBLE
            | fitz.PDF_PERM_PRINT_HQ
        )
        source.save(
            buffer,
            encryption=fitz.PDF_ENCRYPT_AES_256,
            owner_pw=password,
            user_pw=password,
            permissions=permissions,
        )
        return _pdf_response(buffer.getvalue(), "encrypted.pdf", uid)
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_TOOL_VALIDATION_FAILED")
    except Exception:
        return _internal_error("PDF encrypt")
    finally:
        if source is not None:
            source.close()


@pdf_tools_bp.route("/decrypt", methods=["POST"])
@require_auth
def decrypt(uid):
    source = None
    try:
        data = _read_pdf()
        password = request.form.get("password") or ""
        try:
            source = fitz.open(stream=data, filetype="pdf")
        except Exception as exc:
            raise ValueError("유효한 PDF 파일이 아닙니다.") from exc
        if source.is_encrypted and not source.authenticate(password):
            return _error("비밀번호가 올바르지 않습니다.", 403, "PASSWORD_INVALID")
        buffer = io.BytesIO()
        source.save(buffer, encryption=fitz.PDF_ENCRYPT_NONE)
        return _pdf_response(buffer.getvalue(), "decrypted.pdf", uid)
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_TOOL_VALIDATION_FAILED")
    except Exception:
        return _internal_error("PDF decrypt")
    finally:
        if source is not None:
            source.close()


def _is_blank(page: fitz.Page, threshold: float = 0.005) -> bool:
    if page.get_text("text").strip():
        return False
    pixmap = page.get_pixmap(dpi=72, alpha=False)
    samples = pixmap.samples
    count = pixmap.width * pixmap.height
    if count == 0:
        return True
    non_white = 0
    step = max(1, count // 5000)
    bytes_per_pixel = pixmap.n
    for index in range(0, count, step):
        offset = index * bytes_per_pixel
        red, green, blue = samples[offset], samples[offset + 1], samples[offset + 2]
        if red < 240 or green < 240 or blue < 240:
            non_white += 1
    sampled = max(1, count // step)
    return (non_white / sampled) < threshold


@pdf_tools_bp.route("/remove-blank", methods=["POST"])
@require_auth
def remove_blank(uid):
    source = output = None
    try:
        data = _read_pdf()
        source = _open_pdf(data)
        if len(source) > MAX_REMOVE_BLANK_PAGES:
            return _error(
                f"빈 페이지 검사는 최대 {MAX_REMOVE_BLANK_PAGES}페이지까지 처리할 수 있습니다.",
                413,
                "BLANK_PAGE_LIMIT",
            )
        keep = [index for index, page in enumerate(source) if not _is_blank(page)]
        if not keep:
            return _error(
                "모든 페이지가 빈 페이지로 감지되었습니다.",
                400,
                "ALL_PAGES_BLANK",
            )
        output = fitz.open()
        for index in keep:
            output.insert_pdf(source, from_page=index, to_page=index)
        buffer = io.BytesIO()
        output.save(buffer, garbage=4, deflate=True)
        removed = len(source) - len(keep)
        response = _pdf_response(buffer.getvalue(), "no_blanks.pdf", uid)
        response.headers["X-Removed-Count"] = str(removed)
        response.headers["Access-Control-Expose-Headers"] = (
            "X-Removed-Count, Content-Disposition, X-Request-ID"
        )
        return response
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_TOOL_VALIDATION_FAILED")
    except Exception:
        return _internal_error("Blank page removal")
    finally:
        if output is not None:
            output.close()
        if source is not None:
            source.close()
