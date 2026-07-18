"""Standalone PDF utilities with bounded resource usage."""
import io
import re

import fitz
from flask import Blueprint, Response, current_app, jsonify, request

from utils.auth import require_auth

pdf_tools_bp = Blueprint("pdf_tools", __name__)

MAX_FILE = 100 * 1024 * 1024
MAX_IMAGE_FILES = 50
MAX_TOTAL_IMAGE_BYTES = 300 * 1024 * 1024
MAX_OUTPUT_PAGES = 1000
MAX_COMPRESS_PAGES = 500
MAX_GENERAL_PAGES = 2000
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff"}


def _read_pdf(files_key: str = "file") -> bytes:
    uploaded = request.files.get(files_key)
    if not uploaded:
        raise ValueError("파일이 없습니다.")
    if not (uploaded.filename or "").lower().endswith(".pdf"):
        raise ValueError(f"PDF 파일이 아닙니다: {uploaded.filename}")
    data = uploaded.read()
    if len(data) > MAX_FILE:
        raise ValueError("파일이 100MB를 초과합니다.")
    if not data.startswith(b"%PDF"):
        raise ValueError("올바른 PDF 파일이 아닙니다.")
    return data


def _pdf_response(data: bytes, filename: str) -> Response:
    return Response(
        data,
        status=200,
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _parse_ranges(spec: str, total: int) -> list[int]:
    pages: set[int] = set()
    for chunk in re.split(r"[,\s]+", spec.strip()):
        if not chunk:
            continue
        match = re.match(r"^(\d+)\s*-\s*(\d+)$", chunk)
        if match:
            start, end = int(match.group(1)), int(match.group(2))
            if abs(end - start) > MAX_GENERAL_PAGES:
                raise ValueError("페이지 범위가 너무 큽니다.")
            for page in range(min(start, end), max(start, end) + 1):
                if 1 <= page <= total:
                    pages.add(page - 1)
        else:
            try:
                page = int(chunk)
            except ValueError:
                continue
            if 1 <= page <= total:
                pages.add(page - 1)
    if len(pages) > MAX_GENERAL_PAGES:
        raise ValueError(f"한 번에 최대 {MAX_GENERAL_PAGES}페이지까지 처리할 수 있습니다.")
    return sorted(pages)


def _open_pdf(data: bytes, page_limit: int = MAX_GENERAL_PAGES) -> fitz.Document:
    document = fitz.open(stream=data, filetype="pdf")
    if len(document) > page_limit:
        document.close()
        raise ValueError(f"한 번에 최대 {page_limit}페이지까지 처리할 수 있습니다.")
    return document


def _server_error(action: str, uid: str):
    current_app.logger.exception("%s failed for uid=%s", action, uid)
    return jsonify({"detail": f"{action} 중 오류가 발생했습니다. 파일을 확인한 뒤 다시 시도해 주세요."}), 500


@pdf_tools_bp.route("/extract", methods=["POST"])
@require_auth
def extract(uid):
    src = out = None
    try:
        data = _read_pdf()
        ranges = (request.form.get("ranges") or "").strip()
        if not ranges:
            return jsonify({"detail": "페이지 범위를 입력하세요. 예: 1-3,5,7-9"}), 400
        src = _open_pdf(data)
        indexes = _parse_ranges(ranges, len(src))
        if not indexes:
            return jsonify({"detail": "유효한 페이지가 없습니다."}), 400
        out = fitz.open()
        for index in indexes:
            out.insert_pdf(src, from_page=index, to_page=index)
        buffer = io.BytesIO()
        out.save(buffer, garbage=4, deflate=True)
        return _pdf_response(buffer.getvalue(), "extracted.pdf")
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 400
    except Exception:
        return _server_error("페이지 추출", uid)
    finally:
        if out is not None:
            out.close()
        if src is not None:
            src.close()


@pdf_tools_bp.route("/from-images", methods=["POST"])
@require_auth
def from_images(uid):
    out = fitz.open()
    try:
        files = request.files.getlist("files")
        if not files:
            return jsonify({"detail": "이미지가 없습니다."}), 400
        if len(files) > MAX_IMAGE_FILES:
            return jsonify({"detail": f"이미지는 최대 {MAX_IMAGE_FILES}개까지 처리할 수 있습니다."}), 413

        page_size = (request.form.get("size") or "fit").lower()
        if page_size not in {"fit", "a4"}:
            return jsonify({"detail": "지원하지 않는 페이지 크기입니다."}), 400

        total_bytes = 0
        for uploaded in files:
            filename = uploaded.filename or "image"
            extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            if extension not in ALLOWED_IMAGE_EXTENSIONS:
                return jsonify({"detail": f"지원하지 않는 이미지 형식입니다: {filename}"}), 400
            data = uploaded.read()
            if len(data) > MAX_FILE:
                return jsonify({"detail": f"{filename}이(가) 100MB를 초과합니다."}), 413
            total_bytes += len(data)
            if total_bytes > MAX_TOTAL_IMAGE_BYTES:
                return jsonify({"detail": "이미지 전체 용량은 최대 300MB입니다."}), 413

            image_doc = None
            try:
                image_doc = fitz.open(stream=data, filetype=extension)
                for image_page in image_doc:
                    if len(out) >= MAX_OUTPUT_PAGES:
                        return jsonify({"detail": f"출력 페이지는 최대 {MAX_OUTPUT_PAGES}페이지입니다."}), 413
                    source_rect = image_page.rect
                    target_page = out.new_page(width=595, height=842) if page_size == "a4" else out.new_page(width=source_rect.width, height=source_rect.height)
                    pixmap = image_page.get_pixmap(dpi=200, alpha=False)
                    if page_size == "a4":
                        scale = min(target_page.rect.width / pixmap.width, target_page.rect.height / pixmap.height)
                        width, height = pixmap.width * scale, pixmap.height * scale
                        x = (target_page.rect.width - width) / 2
                        y = (target_page.rect.height - height) / 2
                        target_page.insert_image(fitz.Rect(x, y, x + width, y + height), pixmap=pixmap)
                    else:
                        target_page.insert_image(target_page.rect, pixmap=pixmap)
            except Exception:
                if len(out) >= MAX_OUTPUT_PAGES:
                    return jsonify({"detail": f"출력 페이지는 최대 {MAX_OUTPUT_PAGES}페이지입니다."}), 413
                pixmap = fitz.Pixmap(data)
                page = out.new_page(width=pixmap.width, height=pixmap.height)
                page.insert_image(page.rect, pixmap=pixmap)
            finally:
                if image_doc is not None:
                    image_doc.close()

        if len(out) == 0:
            return jsonify({"detail": "변환할 수 있는 이미지가 없습니다."}), 400
        buffer = io.BytesIO()
        out.save(buffer, garbage=4, deflate=True, deflate_images=True)
        return _pdf_response(buffer.getvalue(), "from_images.pdf")
    except Exception:
        return _server_error("이미지 PDF 변환", uid)
    finally:
        out.close()


@pdf_tools_bp.route("/compress", methods=["POST"])
@require_auth
def compress(uid):
    src = out = None
    try:
        data = _read_pdf()
        quality = request.form.get("quality") or "medium"
        dpi_map = {"low": 100, "medium": 150, "high": 200}
        jpg_quality_map = {"low": 50, "medium": 70, "high": 85}
        dpi = dpi_map.get(quality, 150)
        jpg_quality = jpg_quality_map.get(quality, 70)

        src = _open_pdf(data, MAX_COMPRESS_PAGES)
        out = fitz.open()
        for page in src:
            pixmap = page.get_pixmap(dpi=dpi, alpha=False, annots=True)
            jpeg = pixmap.tobytes("jpeg", jpg_quality=jpg_quality)
            new_page = out.new_page(width=page.rect.width, height=page.rect.height)
            new_page.insert_image(page.rect, stream=jpeg)
        buffer = io.BytesIO()
        out.save(buffer, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True)
        response = _pdf_response(buffer.getvalue(), "compressed.pdf")
        response.headers["X-Compression-Mode"] = "rasterized-jpeg"
        response.headers["Access-Control-Expose-Headers"] = "X-Compression-Mode, Content-Disposition"
        return response
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 400
    except Exception:
        return _server_error("PDF 경량화", uid)
    finally:
        if out is not None:
            out.close()
        if src is not None:
            src.close()


@pdf_tools_bp.route("/encrypt", methods=["POST"])
@require_auth
def encrypt(uid):
    src = None
    try:
        data = _read_pdf()
        password = request.form.get("password") or ""
        if len(password) < 4:
            return jsonify({"detail": "비밀번호는 4자 이상 입력하세요."}), 400
        if len(password) > 64:
            return jsonify({"detail": "비밀번호는 64자 이내로 입력하세요."}), 400
        src = _open_pdf(data)
        buffer = io.BytesIO()
        permissions = (
            fitz.PDF_PERM_PRINT | fitz.PDF_PERM_COPY | fitz.PDF_PERM_ANNOTATE
            | fitz.PDF_PERM_FORM | fitz.PDF_PERM_ACCESSIBILITY
            | fitz.PDF_PERM_ASSEMBLE | fitz.PDF_PERM_PRINT_HQ
        )
        src.save(buffer, encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw=password, user_pw=password, permissions=permissions)
        return _pdf_response(buffer.getvalue(), "encrypted.pdf")
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 400
    except Exception:
        return _server_error("PDF 암호 설정", uid)
    finally:
        if src is not None:
            src.close()


@pdf_tools_bp.route("/decrypt", methods=["POST"])
@require_auth
def decrypt(uid):
    src = None
    try:
        data = _read_pdf()
        password = request.form.get("password") or ""
        if len(password) > 64:
            return jsonify({"detail": "비밀번호는 64자 이내로 입력하세요."}), 400
        src = fitz.open(stream=data, filetype="pdf")
        if len(src) > MAX_GENERAL_PAGES:
            return jsonify({"detail": f"한 번에 최대 {MAX_GENERAL_PAGES}페이지까지 처리할 수 있습니다."}), 413
        if src.is_encrypted and not src.authenticate(password):
            return jsonify({"detail": "비밀번호가 올바르지 않습니다."}), 403
        buffer = io.BytesIO()
        src.save(buffer, encryption=fitz.PDF_ENCRYPT_NONE, garbage=4, deflate=True)
        return _pdf_response(buffer.getvalue(), "decrypted.pdf")
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 400
    except Exception:
        return _server_error("PDF 암호 해제", uid)
    finally:
        if src is not None:
            src.close()


def _is_blank(page: fitz.Page, threshold: float = 0.005) -> bool:
    if page.get_text("text").strip():
        return False
    pixmap = page.get_pixmap(dpi=72, alpha=False)
    samples = pixmap.samples
    pixels = pixmap.width * pixmap.height
    if pixels == 0:
        return True
    non_white = 0
    step = max(1, pixels // 5000)
    bytes_per_pixel = pixmap.n
    for index in range(0, pixels, step):
        offset = index * bytes_per_pixel
        red, green, blue = samples[offset], samples[offset + 1], samples[offset + 2]
        if red < 240 or green < 240 or blue < 240:
            non_white += 1
    sampled = max(1, pixels // step)
    return (non_white / sampled) < threshold


@pdf_tools_bp.route("/remove-blank", methods=["POST"])
@require_auth
def remove_blank(uid):
    src = out = None
    try:
        data = _read_pdf()
        src = _open_pdf(data)
        keep = [index for index, page in enumerate(src) if not _is_blank(page)]
        if not keep:
            return jsonify({"detail": "모든 페이지가 빈 페이지로 감지되었습니다."}), 400
        out = fitz.open()
        for index in keep:
            out.insert_pdf(src, from_page=index, to_page=index)
        buffer = io.BytesIO()
        out.save(buffer, garbage=4, deflate=True)
        response = _pdf_response(buffer.getvalue(), "no_blanks.pdf")
        response.headers["X-Removed-Count"] = str(len(src) - len(keep))
        response.headers["Access-Control-Expose-Headers"] = "X-Removed-Count, Content-Disposition"
        return response
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 400
    except Exception:
        return _server_error("빈 페이지 제거", uid)
    finally:
        if out is not None:
            out.close()
        if src is not None:
            src.close()
