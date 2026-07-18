import io
import os
import re

import firebase_admin.storage as fa_storage
import fitz
from flask import Blueprint, Response, current_app, jsonify, request

from models.schemas import PreflightReport
from services.preflight_svc import compute_score, run_all_checks
from utils.auth import require_auth

preflight_bp = Blueprint("preflight", __name__)
MAX_PDF_BYTES = 200 * 1024 * 1024
MAX_PDF_PAGES = 3000
MAX_COMPRESS_PAGES = 1000
DEFAULT_STORAGE_BUCKET = os.environ.get("FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app")


def _bucket():
    return fa_storage.bucket(DEFAULT_STORAGE_BUCKET)


def _read_pdf_from_request():
    uploaded = request.files.get("file")
    if not uploaded:
        return None, None, (jsonify({"detail": "파일이 없습니다"}), 400)
    if not (uploaded.filename or "").lower().endswith(".pdf"):
        return None, None, (jsonify({"detail": "PDF 파일만 업로드 가능합니다"}), 400)
    data = uploaded.read()
    if len(data) > MAX_PDF_BYTES:
        return None, None, (jsonify({"detail": "파일이 200MB 제한을 초과합니다"}), 413)
    if not data.startswith(b"%PDF"):
        return None, None, (jsonify({"detail": "올바른 PDF 파일이 아닙니다"}), 400)
    return uploaded, data, None


def _validate_storage_path(uid: str, path: str | None):
    if not path or not isinstance(path, str):
        return jsonify({"detail": "Storage 파일 경로가 없습니다"}), 400
    if ".." in path or path.startswith("/"):
        return jsonify({"detail": "잘못된 Storage 파일 경로입니다"}), 400
    if not path.startswith(f"preflight_temp/{uid}/"):
        return jsonify({"detail": "이 파일에 접근할 권한이 없습니다"}), 403
    if not path.lower().endswith(".pdf"):
        return jsonify({"detail": "PDF 파일만 처리할 수 있습니다"}), 400
    return None


def _read_pdf_from_storage(uid: str):
    payload = request.get_json(silent=True) or {}
    path = payload.get("storage_path")
    filename = (payload.get("filename") or "document.pdf").strip() or "document.pdf"
    error = _validate_storage_path(uid, path)
    if error:
        return None, None, path, error
    try:
        blob = _bucket().blob(path)
        blob.reload()
        size = int(blob.size or 0)
        if size > MAX_PDF_BYTES:
            return None, None, path, (jsonify({"detail": "파일이 200MB 제한을 초과합니다"}), 413)
        data = blob.download_as_bytes()
        if len(data) > MAX_PDF_BYTES:
            return None, None, path, (jsonify({"detail": "파일이 200MB 제한을 초과합니다"}), 413)
        if not data.startswith(b"%PDF"):
            return None, None, path, (jsonify({"detail": "올바른 PDF 파일이 아닙니다"}), 400)
        return filename, data, path, None
    except Exception:
        current_app.logger.exception("Preflight storage read failed for uid=%s path=%s", uid, path)
        return None, None, path, (jsonify({"detail": "임시 업로드 파일을 읽지 못했습니다. 파일을 다시 선택해 주세요."}), 404)


def _delete_temp(path: str | None) -> None:
    if not path:
        return
    try:
        _bucket().blob(path).delete()
    except Exception:
        current_app.logger.warning("Temporary preflight file cleanup failed: %s", path)


def _open_pdf(data: bytes) -> fitz.Document:
    document = fitz.open(stream=data, filetype="pdf")
    if len(document) > MAX_PDF_PAGES:
        document.close()
        raise ValueError(f"문서 검수는 최대 {MAX_PDF_PAGES}페이지까지 지원합니다")
    return document


def _safe_pdf_name(filename: str | None, suffix: str) -> str:
    base = (filename or "document.pdf").rsplit(".", 1)[0].strip() or "document"
    base = re.sub(r"[^0-9A-Za-z가-힣._-]+", "_", base)[:80] or "document"
    return f"{base}_{suffix}.pdf"


def _json_params() -> dict:
    payload = request.get_json(silent=True) or {}
    params = payload.get("params") or {}
    return params if isinstance(params, dict) else {}


def _compress_options() -> tuple[int, int, str]:
    params = _json_params()
    quality = (request.form.get("quality") or params.get("quality") or "balanced").strip().lower()
    presets = {
        "small": (120, 62, "small"),
        "balanced": (150, 72, "balanced"),
        "clear": (180, 82, "clear"),
    }
    return presets.get(quality, presets["balanced"])


def _run_check_response(filename: str, data: bytes):
    try:
        document = _open_pdf(data)
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 413
    except Exception:
        return jsonify({"detail": "PDF 파일을 열 수 없습니다. PDF 복구/정상화 도구를 먼저 실행해 보세요."}), 400

    try:
        checks = run_all_checks(document, len(data))
        score = compute_score(checks)
        report = PreflightReport(
            filename=(filename or "document.pdf")[:255],
            page_count=len(document),
            checks=checks,
            ai_feedback=None,
            score=score,
        )
        return jsonify(report.model_dump())
    except Exception:
        current_app.logger.exception("Preflight check failed for file=%s", filename)
        return jsonify({"detail": "문서 검수 중 오류가 발생했습니다. PDF 복구/정상화 후 다시 시도해 주세요."}), 500
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
        _delete_temp(path)


def _fix_pdf_response(filename: str, data: bytes):
    try:
        source = _open_pdf(data)
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 413
    except Exception:
        return jsonify({"detail": "PDF 파일을 열 수 없어 자동 복구가 제한됩니다. 원본 프로그램에서 PDF로 다시 저장한 뒤 재시도하세요."}), 400

    output = fitz.open()
    copied_pages = 0
    rasterized_pages = 0
    skipped_pages: list[int] = []
    try:
        if len(source) == 0:
            return jsonify({"detail": "페이지가 없습니다"}), 400
        if source.is_encrypted:
            return jsonify({"detail": "암호화된 PDF는 먼저 암호 해제를 실행한 뒤 복구/정상화를 진행하세요."}), 400

        for index in range(len(source)):
            try:
                page = source[index]
                source_rect = page.rect
                if source_rect.width <= 0 or source_rect.height <= 0:
                    raise ValueError("페이지 크기가 비정상입니다")

                # Preserve each source page's original dimensions. Previous
                # behavior forced every page to the first page's size.
                target_width = float(source_rect.width)
                target_height = float(source_rect.height)
                new_page = output.new_page(width=target_width, height=target_height)
                target_rect = new_page.rect

                try:
                    new_page.show_pdf_page(target_rect, source, index, keep_proportion=True)
                    copied_pages += 1
                except Exception:
                    pixmap = page.get_pixmap(dpi=180, alpha=False, annots=True)
                    new_page.insert_image(target_rect, pixmap=pixmap)
                    rasterized_pages += 1
            except Exception:
                skipped_pages.append(index + 1)

        if len(output) == 0:
            return jsonify({"detail": "복구 가능한 페이지가 없습니다."}), 400

        buffer = io.BytesIO()
        output.save(buffer, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True, clean=True)
        note = f"rebuilt-clean;copied={copied_pages};rasterized={rasterized_pages};skipped={','.join(map(str, skipped_pages))}"
        return Response(
            buffer.getvalue(),
            status=200,
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={_safe_pdf_name(filename, 'repaired')}",
                "X-Fix-Note": note,
                "Access-Control-Expose-Headers": "X-Fix-Note, Content-Disposition",
            },
        )
    except Exception:
        current_app.logger.exception("PDF repair failed for file=%s", filename)
        return jsonify({"detail": "PDF 복구 중 오류가 발생했습니다."}), 500
    finally:
        source.close()
        output.close()


def _compress_pdf_response(filename: str, data: bytes):
    try:
        source = _open_pdf(data)
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 413
    except Exception:
        return jsonify({"detail": "PDF 파일을 열 수 없어 경량화를 진행할 수 없습니다. 먼저 PDF 복구/정상화를 실행해 보세요."}), 400

    output = fitz.open()
    dpi, jpeg_quality, quality = _compress_options()
    skipped_pages: list[int] = []
    try:
        if len(source) == 0:
            return jsonify({"detail": "페이지가 없습니다"}), 400
        if len(source) > MAX_COMPRESS_PAGES:
            return jsonify({"detail": f"경량화는 최대 {MAX_COMPRESS_PAGES}페이지까지 처리할 수 있습니다"}), 413
        if source.is_encrypted:
            return jsonify({"detail": "암호화된 PDF는 먼저 암호 해제를 실행한 뒤 경량화를 진행하세요."}), 400

        matrix = fitz.Matrix(dpi / 72.0, dpi / 72.0)
        for index in range(len(source)):
            try:
                page = source[index]
                rect = page.rect
                if rect.width <= 0 or rect.height <= 0:
                    raise ValueError("페이지 크기가 비정상입니다")
                pixmap = page.get_pixmap(matrix=matrix, alpha=False, annots=True)
                jpeg = pixmap.tobytes("jpeg", jpg_quality=jpeg_quality)
                new_page = output.new_page(width=rect.width, height=rect.height)
                new_page.insert_image(new_page.rect, stream=jpeg)
            except Exception:
                skipped_pages.append(index + 1)

        if len(output) == 0:
            return jsonify({"detail": "경량화 가능한 페이지가 없습니다."}), 400

        buffer = io.BytesIO()
        output.save(buffer, garbage=4, deflate=True, deflate_images=True, clean=True)
        output_bytes = buffer.getvalue()
        note = f"rasterized-jpeg;quality={quality};dpi={dpi};jpg={jpeg_quality};input={len(data)};output={len(output_bytes)};skipped={','.join(map(str, skipped_pages))}"
        return Response(
            output_bytes,
            status=200,
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={_safe_pdf_name(filename, f'light_{quality}')}",
                "X-Compress-Note": note,
                "X-Compression-Mode": "rasterized-jpeg",
                "Access-Control-Expose-Headers": "X-Compress-Note, X-Compression-Mode, Content-Disposition",
            },
        )
    except Exception:
        current_app.logger.exception("PDF compression failed for file=%s", filename)
        return jsonify({"detail": "PDF 경량화 중 오류가 발생했습니다."}), 500
    finally:
        source.close()
        output.close()


@preflight_bp.route("/fix", methods=["POST"])
@require_auth
def fix(uid):
    uploaded, data, error = _read_pdf_from_request()
    if error:
        return error
    return _fix_pdf_response(uploaded.filename or "document.pdf", data)


@preflight_bp.route("/fix-storage", methods=["POST"])
@require_auth
def fix_storage(uid):
    filename, data, path, error = _read_pdf_from_storage(uid)
    try:
        if error:
            return error
        return _fix_pdf_response(filename or "document.pdf", data)
    finally:
        _delete_temp(path)


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
        _delete_temp(path)
